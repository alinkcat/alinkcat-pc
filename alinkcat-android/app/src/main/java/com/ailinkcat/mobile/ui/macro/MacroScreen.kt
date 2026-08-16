package com.ailinkcat.mobile.ui.macro

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel

/**
 * 宏与片段中心：快捷启动图标看板 + 文本片段速记列表。
 */
@Composable
fun MacroScreen(viewModel: ConnectionViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val launcherApps by viewModel.launcherApps.collectAsStateWithLifecycle()
    val snippetItems by viewModel.snippetItems.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var tabIndex by remember { mutableStateOf(0) }

    LaunchedEffect(state.status) {
        if (state.status == ConnectionStatus.Connected) {
            viewModel.requestLauncherList()
            viewModel.requestSnippetList()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        PrimaryTabRow(selectedTabIndex = tabIndex) {
            Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }) {
                Text(stringResource(R.string.quick_launch), modifier = Modifier.padding(12.dp))
            }
            Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }) {
                Text(stringResource(R.string.text_snippets), modifier = Modifier.padding(12.dp))
            }
        }

        if (state.status != ConnectionStatus.Connected) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(stringResource(R.string.please_connect_pc), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            return
        }

        when (tabIndex) {
            0 -> LauncherGrid(
                apps = launcherApps,
                onAppClick = { viewModel.openLauncher(it.id) },
                onAddClick = { Toast.makeText(context, context.getString(R.string.configure_launcher_on_pc), Toast.LENGTH_SHORT).show() }
            )
            1 -> SnippetList(
                items = snippetItems,
                onItemClick = { content ->
                    viewModel.injectSnippet(content)
                    Toast.makeText(context, context.getString(R.string.sent_to_cursor), Toast.LENGTH_SHORT).show()
                }
            )
        }
    }
}

@Composable
private fun LauncherGrid(
    apps: List<com.ailinkcat.mobile.data.model.LauncherApp>,
    onAppClick: (com.ailinkcat.mobile.data.model.LauncherApp) -> Unit,
    onAddClick: () -> Unit
) {
    val columns = 3
    val displayApps = if (apps.size < columns * 2) {
        apps + List(columns * 2 - apps.size) { null }
    } else apps

    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        contentPadding = PaddingValues(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        items(displayApps.size) { index ->
            val app = displayApps[index]
            if (app != null) {
                LauncherCard(app, onAppClick)
            } else {
                AddCard(onAddClick)
            }
        }
    }
}

@Composable
private fun LauncherCard(
    app: com.ailinkcat.mobile.data.model.LauncherApp,
    onClick: (com.ailinkcat.mobile.data.model.LauncherApp) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable { onClick(app) },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = app.iconUrl?.takeIf { it.length < 4 } ?: "📱",
                fontSize = 32.sp
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = app.name,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        }
    }
}

@Composable
private fun AddCard(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("+", fontSize = 36.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
            Spacer(Modifier.height(4.dp))
            Text(stringResource(R.string.add), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

@Composable
private fun SnippetList(
    items: List<com.ailinkcat.mobile.data.model.SnippetItem>,
    onItemClick: (String) -> Unit
) {
    if (items.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.no_snippets_hint), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        items(items, key = { it.id }) { item ->
            SnippetCard(item, onItemClick)
        }
    }
}

@Composable
private fun SnippetCard(
    item: com.ailinkcat.mobile.data.model.SnippetItem,
    onClick: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable { onClick(item.content) }
            .padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            item.category?.let { cat ->
                Text(
                    text = cat,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                )
                Spacer(Modifier.width(8.dp))
            }
            Text(
                text = item.label,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            text = item.content,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}
