package com.cat.psych;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.cat.psych.widget.PsychWidgetPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PsychWidgetPlugin.class);   // home-screen widgets (scripts/android-widget)
        super.onCreate(savedInstanceState);
    }
}
