package com.cat.psych.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** The app's side of the widgets: send the snapshot, collect taps, ask the launcher to place a widget,
 *  and switch the background step sync on or off (PsychStepsJob). */
@CapacitorPlugin(name = "PsychWidget", permissions = {
    @Permission(alias = "healthBg", strings = { PsychStepsJob.READ_BG })   // Health Connect: read in the background
})
public class PsychWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "{}");
        Context c = getContext();
        PsychWidgetProvider.prefs(c).edit().putString("snapshot", data).apply();
        PsychWidgetProvider.refreshAll(c);
        PsychStepsJob.schedule(c);   // keeps the background step sync running if it's on
        call.resolve();
    }

    // ---------- background step sync (Settings > Step sync) ----------
    /** { supported: Android 14+, allowed: permission given, on: switched on } */
    @PluginMethod
    public void bgStatus(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("supported", PsychStepsJob.supported());
        r.put("allowed", PsychStepsJob.allowed(c));
        r.put("on", PsychStepsJob.on(c));
        call.resolve(r);
    }

    /** Switch it on: asks for the "read in the background" permission first if needed. Resolves { on }. */
    @PluginMethod
    public void bgOn(PluginCall call) {
        if (!PsychStepsJob.supported()) { JSObject r = new JSObject(); r.put("on", false); r.put("reason", "android"); call.resolve(r); return; }
        if (getPermissionState("healthBg") == PermissionState.GRANTED) { finishOn(call); return; }
        requestPermissionForAlias("healthBg", call, "bgPermResult");
    }

    @PermissionCallback
    private void bgPermResult(PluginCall call) {
        if (getPermissionState("healthBg") == PermissionState.GRANTED) { finishOn(call); return; }
        JSObject r = new JSObject(); r.put("on", false); r.put("reason", "denied"); call.resolve(r);
    }

    private void finishOn(PluginCall call) {
        Context c = getContext();
        PsychWidgetProvider.prefs(c).edit().putBoolean("bg_steps", true).apply();
        PsychStepsJob.schedule(c);
        JSObject r = new JSObject(); r.put("on", PsychStepsJob.allowed(c)); call.resolve(r);
    }

    @PluginMethod
    public void bgOff(PluginCall call) {
        Context c = getContext();
        PsychWidgetProvider.prefs(c).edit().putBoolean("bg_steps", false).apply();
        PsychStepsJob.schedule(c);   // cancels it
        call.resolve();
    }

    @PluginMethod
    public void takeActions(PluginCall call) {
        Context c = getContext();
        String a = PsychWidgetProvider.prefs(c).getString("actions", "[]");
        PsychWidgetProvider.prefs(c).edit().putString("actions", "[]").apply();
        JSObject r = new JSObject();
        r.put("actions", a);
        call.resolve(r);
    }

    /** Which widgets are on the home screen: their ids, or "size:4x1" for one added from the launcher's list. */
    @PluginMethod
    public void placed(PluginCall call) {
        Context c = getContext();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        StringBuilder out = new StringBuilder();
        String[] sizes = PsychWidgetProvider.SIZES;
        for (int i = 0; i < PsychWidgetProvider.PROVIDERS.length; i++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, PsychWidgetProvider.PROVIDERS[i]));
            if (ids == null) continue;
            for (int id : ids) {
                String cfg = PsychWidgetProvider.prefs(c).getString("map_" + id, null);
                if (out.length() > 0) out.append(',');
                out.append(cfg != null ? cfg : "size:" + sizes[i]);
            }
        }
        JSObject r = new JSObject();
        r.put("ids", out.toString());
        call.resolve(r);
    }

    @PluginMethod
    public void pin(PluginCall call) {
        Context c = getContext();
        String size = call.getString("size", "4x1"), id = call.getString("id", "");
        JSObject r = new JSObject();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !m.isRequestPinAppWidgetSupported()) { r.put("pinned", false); call.resolve(r); return; }
        Class<?> cls = PsychWidgetProvider.providerFor(size);
        Intent cb = new Intent(c, cls).setAction(PsychWidgetProvider.ACTION_PINNED).putExtra("configId", id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, id.hashCode() & 0x7fffffff, cb, flags);
        boolean ok = m.requestPinAppWidget(new ComponentName(c, cls), null, pi);
        r.put("pinned", ok);
        call.resolve(r);
    }
}
