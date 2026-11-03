import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ---- Configuration -------------------------------------------------------
// The anon/publishable key is public by design: Row Level Security protects the data.
// The admin PASSWORD is never in this file. It lives only in Supabase Auth.
const SUPABASE_URL = "https://etrvylzkbentjoejrilz.supabase.co";
const SUPABASE_KEY = "sb_publishable_y69t-K_2nEX2i_04m7jGag_mZjh1E0s";
const ADMIN_EMAIL = "mittendev.sa@gmail.com"; // same email as the Supabase Auth user + SQL
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (n, cls = "") => `<iconify-icon icon="tabler:${n}" class="${cls}"></iconify-icon>`;
const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
let apps = [];
let filter = "all";
let query = "";
// ---- UI helpers ----------------------------------------------------------
function toast(msg, error = false) {
    const t = document.createElement("div");
    t.className = "toast" + (error ? " error" : "");
    t.innerHTML = icon(error ? "alert-circle" : "check") + `<span>${esc(msg)}</span>`;
    $("#toasts").append(t);
    setTimeout(() => t.remove(), 4000);
}
async function busy(btn, label, fn) {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = icon("loader-2", "spin") + `<span>${label}</span>`;
    try {
        await fn();
    }
    finally {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.innerHTML = orig;
    }
}
function show(id) {
    document.querySelectorAll("[data-view]").forEach((v) => (v.hidden = v.id !== id));
    window.scrollTo(0, 0);
    if (id === "admin")
        refreshAdmin();
}
const confirmDlg = $("#confirm");
const ask = () => new Promise((res) => {
    confirmDlg.returnValue = "";
    confirmDlg.addEventListener("close", () => res(confirmDlg.returnValue === "ok"), { once: true });
    confirmDlg.showModal();
});
// ---- Admin: auth, data, rendering ---------------------------------------
async function refreshAdmin() {
    const { data } = await sb.auth.getSession();
    const ok = data.session?.user.email === ADMIN_EMAIL;
    $("#login").hidden = ok;
    $("#dash").hidden = !ok;
    if (ok)
        await load();
}
async function load() {
    const { data, error } = await sb.from("applications").select("*").order("created_at", { ascending: false });
    if (error)
        return toast("Couldn't load applications: " + error.message, true);
    apps = data;
    render();
    const d = $("#detail");
    if (d.open && d.dataset.id)
        openApp(d.dataset.id);
}
const actions = (a, withOpen = false) => `<div class="acts">
  ${withOpen ? `<button class="btn" data-open="${a.id}">${icon("eye")}Open</button>` : ""}
  ${a.status !== "approved" ? `<button class="btn" data-act="approved" data-id="${a.id}">${icon("check")}Approve</button>` : ""}
  ${a.status !== "rejected" ? `<button class="btn" data-act="rejected" data-id="${a.id}">${icon("x")}Reject</button>` : ""}
  ${a.status !== "pending" ? `<button class="btn" data-act="pending" data-id="${a.id}">${icon("clock")}Mark pending</button>` : ""}
  <button class="btn danger" data-act="delete" data-id="${a.id}" aria-label="Delete application">${icon("trash")}</button>
</div>`;
const card = (a) => `<article class="app">
  <div class="top"><strong>${esc(a.discord_username)}</strong><span class="badge ${a.status}">${a.status}</span></div>
  <small class="muted">${fmt(a.created_at)}</small>
  <p>${esc(a.reason)}</p>
  ${actions(a, true)}
</article>`;
function render() {
    $("#s-total").textContent = String(apps.length);
    for (const k of ["pending", "approved", "rejected"])
        $("#s-" + k).textContent = String(apps.filter((a) => a.status === k).length);
    const q = query.trim().toLowerCase();
    const rows = apps.filter((a) => (filter === "all" || a.status === filter) && a.discord_username.toLowerCase().includes(q));
    $("#list").innerHTML = rows.length ? rows.map(card).join("") : `<div class="empty">${icon("inbox")}No applications found</div>`;
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("on", b.dataset.filter === filter));
}
function openApp(id) {
    const a = apps.find((x) => x.id === id);
    if (!a)
        return;
    const d = $("#detail");
    d.dataset.id = id;
    d.innerHTML = `<div class="top"><h3>${esc(a.discord_username)}</h3><span class="badge ${a.status}">${a.status}</span></div>
    <small class="muted">Submitted ${fmt(a.created_at)}</small>
    <p class="reason">${esc(a.reason)}</p>
    ${actions(a)}
    <div class="row"><button class="btn" data-close>Close</button></div>`;
    if (!d.open)
        d.showModal();
}
async function setStatus(id, status) {
    const { data, error } = await sb.from("applications").update({ status }).eq("id", id).select("id");
    if (error || !data?.length)
        return toast("Couldn't update. Try signing in again.", true);
    toast(`Marked as ${status}`);
    await load();
}
async function remove(id) {
    if (!(await ask()))
        return;
    const { data, error } = await sb.from("applications").delete().eq("id", id).select("id");
    if (error || !data?.length)
        return toast("Couldn't delete. Try signing in again.", true);
    $("#detail").close();
    toast("Application deleted");
    await load();
}
// ---- Events --------------------------------------------------------------
document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-nav],[data-act],[data-open],[data-filter],[data-close]");
    if (!t)
        return;
    const d = t.dataset;
    if (d.nav)
        show(d.nav);
    else if (d.open)
        openApp(d.open);
    else if (d.filter) {
        filter = d.filter;
        render();
    }
    else if (d.close !== undefined)
        $("#detail").close();
    else if (d.act)
        d.act === "delete" ? remove(d.id) : setStatus(d.id, d.act);
});
$("#q").addEventListener("input", (e) => { query = e.target.value; render(); });
$("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#pw");
    await busy($("#login button"), "Signing in", async () => {
        const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pw.value });
        pw.value = "";
        if (error)
            return toast("Incorrect password.", true);
        toast("Signed in");
        await refreshAdmin();
    });
});
$("#logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    apps = [];
    await refreshAdmin();
    toast("Signed out");
});
// ---- Application form ----------------------------------------------------
function fieldErr(el, msg) {
    el.setAttribute("aria-invalid", String(!!msg));
    $("#" + el.id + "-err").textContent = msg;
}
$("#apply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const u = $("#username");
    const r = $("#reason");
    const name = u.value.trim().replace(/^@/, "").toLowerCase();
    const reason = r.value.trim();
    const eu = /^[a-z0-9_.]{2,32}$/.test(name) ? "" : "Use 2 to 32 letters, numbers, underscores or periods.";
    const er = reason.length < 20 ? "Write at least 20 characters." : reason.length > 2000 ? "Keep it under 2000 characters." : "";
    fieldErr(u, eu);
    fieldErr(r, er);
    if (eu || er)
        return toast("Fix the highlighted fields and try again.", true);
    await busy($("#apply-form button"), "Submitting", async () => {
        const { error } = await sb.from("applications").insert({ discord_username: name, reason });
        if (error)
            return toast(error.code === "23505" ? "An application for this username already exists." : "Couldn't submit. Check your connection and try again.", true);
        form.reset();
        toast("Application submitted. We'll be in touch on Discord.");
        show("home");
    });
});
// New applications appear automatically (realtime, with a polling fallback)
sb.channel("applications").on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => { if (!$("#dash").hidden)
    load(); }).subscribe();
setInterval(() => { if (!$("#dash").hidden)
    load(); }, 30000);
$("#year").textContent = String(new Date().getFullYear());
