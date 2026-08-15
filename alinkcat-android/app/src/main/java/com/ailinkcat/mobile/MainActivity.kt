package com.ailinkcat.mobile

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ailinkcat.mobile.ui.AlinkcatApp
import com.ailinkcat.mobile.ui.theme.AlinkcatTheme
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import com.ailinkcat.mobile.utils.SignatureVerifier

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // debug 构建跳过校验（签名不同）；release 构建必须通过 Native 签名校验
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

/**
 * 签名校验失败提示页：签名不匹配说明应用可能被篡改重打包，
 * 展示警告信息并引导用户退出，而不是白屏。
 */
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
                text = "应用签名校验失败",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "检测到当前安装包与官方签名不一致，\n应用可能已被篡改，请从官方渠道重新安装。",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 24.dp)
            )
            Spacer(Modifier.height(24.dp))
            TextButton(onClick = onExit) {
                Text("退出应用")
            }
        }
    }
}