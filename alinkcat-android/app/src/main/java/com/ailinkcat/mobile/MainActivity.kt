package com.ailinkcat.mobile

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.Coil
import coil.ImageLoader
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import com.ailinkcat.mobile.i18n.LanguageManager
import com.ailinkcat.mobile.ui.AlinkcatApp
import com.ailinkcat.mobile.ui.theme.AlinkcatTheme
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import com.ailinkcat.mobile.utils.SignatureVerifier

class MainActivity : ComponentActivity() {

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(LanguageManager.get(newBase).attachBaseContext(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // register gif decoders explicitly, ServiceLoader discovery breaks under release minification
        Coil.setImageLoader(
            ImageLoader.Builder(this)
                .components {
                    add(GifDecoder.Factory())
                    add(ImageDecoderDecoder.Factory())
                }
                .build()
        )

        // debug builds skip verification (different signing key); release must pass the native check
        val isDebuggable = (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
        val signatureValid = isDebuggable || SignatureVerifier.verify(this)

        enableEdgeToEdge()
        setContent {
            AlinkcatTheme {
                if (signatureValid) {
                    val viewModel: ConnectionViewModel = viewModel()
                    AlinkcatApp(connectionViewModel = viewModel)
                } else {
                    SignatureErrorScreen(onExit = { finish() })
                }
            }
        }
    }
}

/** signature mismatch means the apk was likely repackaged; warn and offer exit instead of a blank screen */
@Composable
private fun SignatureErrorScreen(onExit: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(32.dp)
        ) {
            Text("⚠️", fontSize = 56.sp)
            Spacer(Modifier.height(20.dp))
            Text(
                text = stringResource(R.string.signature_verify_failed),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = stringResource(R.string.signature_tamper_warning),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 24.dp)
            )
            Spacer(Modifier.height(24.dp))
            TextButton(onClick = onExit) {
                Text(stringResource(R.string.exit_app))
            }
        }
    }
}
