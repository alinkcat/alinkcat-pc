package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ailinkcat.mobile.domain.models.CardWidget
import com.ailinkcat.mobile.ui.render.parseFontWeight
import com.ailinkcat.mobile.utils.ColorParser
import java.io.File

/**
 * 信息卡片控件：整合文本（标题/描述）+ 配图 + 标签 + 底部辅助文字。
 * 图片位置支持 top / left / right，使用 Coil 加载。
 * 图片路径解析：data: URI 直接使用，否则相对于 themeDir/themeId 目录。
 * 适配移动端：自适应容器尺寸，文字溢出省略号，标签药丸样式。
 */
@Composable
fun CardWidgetRenderer(
    widget: CardWidget,
    themeDir: File,
    themeId: String
) {
    val bg = ColorParser.withOpacity(
        ColorParser.parse(widget.backgroundColor, Color(0xFFF0F2F5)),
        widget.backgroundOpacity
    )
    val fg = ColorParser.parse(widget.textColor, Color(0xFF333333))
    val radius = (widget.borderRadius ?: 6).dp
    val baseFontSize = (widget.fontSize ?: 12).sp
    val titleFontSize = if (baseFontSize.value < 14f) 14.sp else baseFontSize
    val descFontSize = baseFontSize
    val tagFontSize = (baseFontSize.value * 0.75f).coerceAtLeast(9f).sp

    val hasImage = !widget.cardImage.isNullOrBlank()
    // 解析图片路径：data: URI 直接使用，否则拼接主题目录
    val resolvedImage = remember(widget.cardImage) {
        when {
            widget.cardImage.isNullOrBlank() -> null
            widget.cardImage.startsWith("data:") -> widget.cardImage
            else -> File(themeDir, themeId).resolve(widget.cardImage).toURI().toString()
        }
    }

    // top layout: column, side layout: row
    val isSide = widget.cardImagePosition == "left" || widget.cardImagePosition == "right"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(radius))
            .background(bg)
    ) {
        if (isSide) {
            // left/right: Row layout
            Row(
                modifier = Modifier.fillMaxSize()
            ) {
                if (widget.cardImagePosition == "left") {
                    CardImageSection(
                        imageUrl = resolvedImage,
                        hasImage = hasImage,
                        isSide = true,
                        modifier = Modifier.weight(0.4f).fillMaxSize()
                    )
                    CardContentSection(
                        cardTitle = widget.cardTitle,
                        cardDesc = widget.cardDesc,
                        cardTags = widget.cardTags,
                        cardFooter = widget.cardFooter,
                        fg = fg,
                        titleFontSize = titleFontSize,
                        descFontSize = descFontSize,
                        tagFontSize = tagFontSize,
                        modifier = Modifier.weight(0.6f).fillMaxSize()
                    )
                } else {
                    // right
                    CardContentSection(
                        cardTitle = widget.cardTitle,
                        cardDesc = widget.cardDesc,
                        cardTags = widget.cardTags,
                        cardFooter = widget.cardFooter,
                        fg = fg,
                        titleFontSize = titleFontSize,
                        descFontSize = descFontSize,
                        tagFontSize = tagFontSize,
                        modifier = Modifier.weight(0.6f).fillMaxSize()
                    )
                    CardImageSection(
                        imageUrl = resolvedImage,
                        hasImage = hasImage,
                        isSide = true,
                        modifier = Modifier.weight(0.4f).fillMaxSize()
                    )
                }
            }
        } else {
            // top: Column layout
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                CardImageSection(
                    imageUrl = resolvedImage,
                    hasImage = hasImage,
                    isSide = false,
                    modifier = Modifier.fillMaxWidth().weight(0.5f)
                )
                CardContentSection(
                    cardTitle = widget.cardTitle,
                    cardDesc = widget.cardDesc,
                    cardTags = widget.cardTags,
                    cardFooter = widget.cardFooter,
                    fg = fg,
                    titleFontSize = titleFontSize,
                    descFontSize = descFontSize,
                    tagFontSize = tagFontSize,
                    modifier = Modifier.fillMaxWidth().weight(0.5f)
                )
            }
        }
    }
}

@Composable
private fun CardImageSection(
    imageUrl: String?,
    hasImage: Boolean,
    isSide: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0x11000000)),
        contentAlignment = Alignment.Center
    ) {
        if (hasImage && imageUrl != null) {
            // Support both data URI and regular URLs
            val model = remember(imageUrl) {
                if (imageUrl.startsWith("data:")) imageUrl
                else imageUrl
            }
            AsyncImage(
                model = model,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Text("📷", fontSize = 24.sp)
        }
    }
}

@Composable
private fun CardContentSection(
    cardTitle: String,
    cardDesc: String,
    cardTags: List<String>,
    cardFooter: String,
    fg: Color,
    titleFontSize: androidx.compose.ui.unit.TextUnit,
    descFontSize: androidx.compose.ui.unit.TextUnit,
    tagFontSize: androidx.compose.ui.unit.TextUnit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .padding(horizontal = 8.dp, vertical = 6.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            // Title
            if (cardTitle.isNotBlank()) {
                Text(
                    text = cardTitle,
                    color = fg,
                    fontSize = titleFontSize,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Description
            if (cardDesc.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = cardDesc,
                    color = fg.copy(alpha = 0.75f),
                    fontSize = descFontSize,
                    overflow = TextOverflow.Visible,
                    lineHeight = (descFontSize.value * 1.4f).sp,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        // Tags
        if (cardTags.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                cardTags.forEach { tag ->
                    Text(
                        text = tag,
                        color = fg,
                        fontSize = tagFontSize,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(fg.copy(alpha = 0.12f))
                            .padding(horizontal = 6.dp, vertical = 1.dp)
                    )
                }
            }
        }

        // Footer
        if (cardFooter.isNotBlank()) {
            Spacer(Modifier.height(2.dp))
            Text(
                text = cardFooter,
                color = fg.copy(alpha = 0.5f),
                fontSize = (descFontSize.value * 0.85f).sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}