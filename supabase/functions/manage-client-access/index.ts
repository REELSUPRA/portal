// ============================================================
// REELSUPRA — Edge Function: manage-client-access
// ============================================================
// Única pieza del proyecto que usa la service_role key — vive en el
// servidor de Supabase, nunca en el navegador. El panel admin le pega
// un request normal (via supabase.functions.invoke, que ya manda el
// JWT de la sesión actual solo) y esta función:
//   1. Verifica que quien llama es realmente admin (profiles.role) —
//      no confía en que "solo el panel la invoca".
//   2. Recién ahí usa la Auth Admin API para invitar/revocar/cambiar
//      email de la cuenta de un cliente.
//
// Acciones (body: { action, clientId, email? }):
//   - "invite"       — primera vez. Crea la cuenta (Supabase manda el
//                      email de invitación), guarda portal_user_id.
//   - "create_manual" — primera vez, sin depender del email: el admin
//                      define email + contraseña temporal a mano. La
//                      cuenta queda confirmada y lista para loguearse
//                      de inmediato (sin flujo de invitación).
//   - "resend"       — reenvía la invitación a portal_email.
//   - "grant"        — restaura el acceso de alguien ya invitado antes
//                      (portal_user_id existente) sin mandar invitación
//                      nueva — la cuenta ya existe.
//   - "revoke"       — borra el vínculo en profiles (pierde acceso),
//                      pero NO borra la cuenta de Auth ni portal_user_id
//                      — así "grant" puede restaurarlo después.
//   - "change_email" — actualiza el email en Auth + en clients.
//   - "set_password" — el admin le asigna una contraseña nueva a una
//                      cuenta que YA existe, sin borrarla/recrearla
//                      (ej: el cliente la perdió, o se creó mal).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ ok: false, error: "No autenticado" }, 401);

    // Cliente "como quien llama" — respeta RLS, solo sirve para
    // confirmar identidad y rol, nunca para las acciones privilegiadas.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ ok: false, error: "Sesión inválida" }, 401);

    const { data: profile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return json({ ok: false, error: "No autorizado" }, 403);
    }

    // Recién acá se usa la service_role — ya confirmamos que quien
    // llama es admin.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { action, clientId, email, password } = await req.json();
    if (!clientId) return json({ ok: false, error: "Falta clientId" }, 400);

    const { data: clientRow, error: clientErr } = await adminClient
      .from("clients")
      .select("id, portal_email, portal_user_id, portal_access_status")
      .eq("id", clientId)
      .single();
    if (clientErr || !clientRow) return json({ ok: false, error: "Cliente no encontrado" }, 404);

    if (action === "invite") {
      if (!email) return json({ ok: false, error: "Falta email" }, 400);
      if (clientRow.portal_user_id) {
        return json({ ok: false, error: "Este cliente ya fue invitado antes — usá Reenviar o Restaurar acceso." }, 400);
      }
      const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (inviteErr) return json({ ok: false, error: inviteErr.message }, 400);

      await adminClient.from("profiles").upsert({ id: invited.user.id, role: "client", client_id: clientId });
      await adminClient
        .from("clients")
        .update({ portal_email: email, portal_user_id: invited.user.id, portal_access_status: "invitado" })
        .eq("id", clientId);

      return json({ ok: true, portalEmail: email, portalAccessStatus: "invitado" });
    }

    if (action === "create_manual") {
      if (!email) return json({ ok: false, error: "Falta email" }, 400);
      if (!password || password.length < 8) {
        return json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" }, 400);
      }
      if (clientRow.portal_user_id) {
        return json({ ok: false, error: "Este cliente ya tiene una cuenta — usá Reenviar o Restaurar acceso." }, 400);
      }
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return json({ ok: false, error: createErr.message }, 400);

      await adminClient.from("profiles").upsert({ id: created.user.id, role: "client", client_id: clientId });
      await adminClient
        .from("clients")
        .update({ portal_email: email, portal_user_id: created.user.id, portal_access_status: "invitado" })
        .eq("id", clientId);

      return json({ ok: true, portalEmail: email, portalAccessStatus: "invitado" });
    }

    if (action === "resend") {
      if (!clientRow.portal_email) return json({ ok: false, error: "No hay email para reenviar" }, 400);
      const { error: resendErr } = await adminClient.auth.admin.inviteUserByEmail(clientRow.portal_email);
      if (resendErr) return json({ ok: false, error: resendErr.message }, 400);
      return json({ ok: true, portalEmail: clientRow.portal_email, portalAccessStatus: "invitado" });
    }

    if (action === "grant") {
      if (!clientRow.portal_user_id) {
        return json({ ok: false, error: "Este cliente nunca fue invitado — usá Dar acceso primero." }, 400);
      }
      await adminClient
        .from("profiles")
        .upsert({ id: clientRow.portal_user_id, role: "client", client_id: clientId });
      await adminClient.from("clients").update({ portal_access_status: "invitado" }).eq("id", clientId);
      return json({ ok: true, portalEmail: clientRow.portal_email, portalAccessStatus: "invitado" });
    }

    if (action === "revoke") {
      if (clientRow.portal_user_id) {
        await adminClient.from("profiles").delete().eq("id", clientRow.portal_user_id);
      }
      await adminClient.from("clients").update({ portal_access_status: "revocado" }).eq("id", clientId);
      return json({ ok: true, portalEmail: clientRow.portal_email, portalAccessStatus: "revocado" });
    }

    if (action === "set_password") {
      if (!password || password.length < 8) {
        return json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" }, 400);
      }
      if (!clientRow.portal_user_id) {
        return json({ ok: false, error: "Este cliente todavía no tiene una cuenta — creala primero." }, 400);
      }
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(clientRow.portal_user_id, { password });
      if (pwErr) return json({ ok: false, error: pwErr.message }, 400);

      return json({ ok: true, portalEmail: clientRow.portal_email, portalAccessStatus: clientRow.portal_access_status });
    }

    if (action === "change_email") {
      if (!email) return json({ ok: false, error: "Falta email" }, 400);
      if (!clientRow.portal_user_id) {
        return json({ ok: false, error: "Este cliente todavía no tiene una cuenta — invitalo primero." }, 400);
      }
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(clientRow.portal_user_id, { email });
      if (updateErr) return json({ ok: false, error: updateErr.message }, 400);

      await adminClient.from("clients").update({ portal_email: email }).eq("id", clientId);
      return json({ ok: true, portalEmail: email, portalAccessStatus: clientRow.portal_access_status });
    }

    return json({ ok: false, error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }, 500);
  }
});
