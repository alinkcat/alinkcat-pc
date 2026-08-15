package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ailinkcat.mobile.domain.models.LauncherIconWidget
import java.io.File

/**
 * 单体应用启动图标：从主题包 assets/ 目录加载图标，点击触发 launcher.open。
 */
@Composable
fun LauncherIconWidgetRenderer(
    widget: LauncherIconWidget,
    themeDir: File,
    themeId: String,
    onClick: () -> Unit
) {
    val iconFile = remember(widget.icon, themeId) {
        widget.icon?.takeIf { it.isNotBlank() && !it.startsWith("data:") }?.let {
            File(themeDir, "$themeId/$it")
        }
    }
    val hasIconFile = iconFile?.exists() == true
    val isEmoji = !hasIconFile && widget.icon?.let { it.length <= 4 && it.all { c -> c.isSurrogate() || c.code in 0x1F000..0x1FFFF } } == true

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0x1AFFFFFF))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            // 图标：优先加载本地文件，其次 emoji，最后占位符
            if (hasIconFile) {
                AsyncImage(
                    model = iconFile,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(8.dp)
                )
            } else {
                Text(
                    text = if (isEmoji) widget.icon!! else "📱",
                    fontSize = 28.sp
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = widget.label,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}