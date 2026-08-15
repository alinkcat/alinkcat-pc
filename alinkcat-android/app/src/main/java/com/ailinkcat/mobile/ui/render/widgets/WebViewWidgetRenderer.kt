package com.ailinkcat.mobile.ui.render.widgets

import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.ailinkcat.mobile.domain.models.WebViewWidget

/**
 * WebView 控件：加载 URL。
 */
@Composable
fun WebViewWidgetRenderer(widget: WebViewWidget) {
    val url = widget.url
    if (url.isNullOrBlank()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF222222)),
            contentAlignment = Alignment.Center
        ) {
            Text("🔗", fontSize = 24.sp, color = Color.Gray)
        }
        return
    }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.loadWithOverviewMode = true
                settings.useWideViewPort = true
                webViewClient = WebViewClient()
                loadUrl(url)
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}
