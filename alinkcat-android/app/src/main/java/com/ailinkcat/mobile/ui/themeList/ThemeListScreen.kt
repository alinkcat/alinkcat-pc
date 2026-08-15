package com.ailinkcat.mobile.ui.themeList

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.data.model.ThemePackage
import com.ailinkcat.mobile.ui.render.ThemeRenderActivity
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import java.io.File

/**
 * Tab 1：主题包列表。
 * 支持本地主题包展示、点击切换、长按删除。
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ThemeListScreen(viewModel: ConnectionViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val themes by viewModel.themePackages.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var deleteTarget by remember { mutableStateOf<ThemePackage?>(null) }

    // 连接成功后刷新已安装主题包
    LaunchedEffect(state.status) {
        if (state.status == ConnectionStatus.Connected) {
            viewModel.refreshThemePackages()
        }
    }

    fun onThemeClick(pkg: ThemePackage) {
        val themeId = pkg.themeId
        if (themeId.isNullOrBlank()) {
            Toast.makeText(context, "该主题包尚未下载到本机", Toast.LENGTH_SHORT).show()
            return
        }
        context.startActivity(
            Intent(context, ThemeRenderActivity::class.java)
                .putExtra(ThemeRenderActivity.EXTRA_THEME_ID, themeId)
        )
    }

    fun onThemeLongClick(pkg: ThemePackage) {
        if (pkg.themeId != null) deleteTarget = pkg
    }

    // 删除确认对话框
    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("删除主题包") },
            text = { Text("确定要删除「${target.name}」吗？\n已下载的文件将被永久移除。") },
            confirmButton = {
                TextButton(onClick = {
                    target.themeId?.let(viewModel::deleteTheme)
                    deleteTarget = null
                }) { Text("删除", color = ErrorRed) }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("取消") }
            }
        )
    }

    when {
        state.status != ConnectionStatus.Connected -> EmptyState(
            emoji = "🔌",
            title = "请先连接 PC",
            subtitle = "在「配置」页面完成 WebSocket 连接后即可查看主题包"
        )

        themes.isEmpty() -> EmptyState(
            emoji = "📦",
            title = "暂无主题包",
            subtitle = "连接 PC 后在电脑端发布主题包，将自动同步到此处"
        )

        else -> LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(themes, key = { it.themeId ?: it.name }) { pkg ->
                ThemeCard(
                    pkg = pkg,
                    onClick = { onThemeClick(pkg) },
                    onLongClick = { onThemeLongClick(pkg) }
                )
            }
        }
    }
}

@Composable
fun EmptyState(emoji: String, title: String, subtitle: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(emoji, fontSize = 48.sp)
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp)
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ThemeCard(
    pkg: ThemePackage,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    val context = LocalContext.current
    val coverFile = pkg.themeId?.let { File(context.filesDir, "themes/$it/cover.png") }
    val hasCover = coverFile?.exists() == true

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 封面
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(pkg.coverColor)),
                contentAlignment = Alignment.Center
            ) {
                if (hasCover) {
                    AsyncImage(
                        model = coverFile,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Text(pkg.coverEmoji, fontSize = 28.sp)
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = pkg.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (pkg.isActive) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "✅ 当前使用",
                            style = MaterialTheme.typography.labelSmall,
                            color = SuccessGreen
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "v${pkg.version} · ${pkg.author}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(6.dp))
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Text(
                        text = " ${pkg.pageCount} 页 ",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}