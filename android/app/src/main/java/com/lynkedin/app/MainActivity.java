package com.lynkedin.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw behind system bars (status bar + navigation bar)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
