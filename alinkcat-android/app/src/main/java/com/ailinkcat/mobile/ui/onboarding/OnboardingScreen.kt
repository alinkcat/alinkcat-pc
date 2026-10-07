package com.ailinkcat.mobile.ui.onboarding

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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.ui.theme.BrandBlue
import com.ailinkcat.mobile.ui.theme.BrandPurple
import kotlinx.coroutines.launch

/**
 * First-run onboarding. The last page requires agreeing to the terms and
 * privacy policy before entering the app.
 */
@Composable
fun OnboardingScreen(onFinished: () -> Unit) {
    val pagerState = rememberPagerState(pageCount = { 3 })
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var consentChecked by remember { mutableStateOf(false) }

    fun openDoc(url: String) {
        try {
            context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
        } catch (_: Exception) {
        }
    }

    val pages = listOf(
        OnboardingPage(
            emoji = "🔗",
            title = stringResource(R.string.onboarding_connect_title),
            desc = stringResource(R.string.onboarding_connect_desc)
        ),
        OnboardingPage(
            emoji = "📦",
            title = stringResource(R.string.onboarding_receive_title),
            desc = stringResource(R.string.onboarding_receive_desc)
        ),
        OnboardingPage(
            emoji = "🚀",
            title = stringResource(R.string.onboarding_start_title),
            desc = stringResource(R.string.onboarding_start_desc)
        ),
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(BrandBlue, BrandPurple)))
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 40.dp)
        ) { pageIndex ->
            val page = pages[pageIndex]
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(RoundedCornerShape(28.dp))
                        .background(Color.White.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = page.emoji,
                        fontSize = 56.sp
                    )
                }

                Spacer(Modifier.height(32.dp))

                Text(
                    text = page.title,
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(12.dp))

                Text(
                    text = page.desc,
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 15.sp,
                    lineHeight = 22.sp,
                    textAlign = TextAlign.Center
                )
            }
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(3) { index ->
                    Box(
                        modifier = Modifier
                            .size(if (index == pagerState.currentPage) 10.dp else 8.dp)
                            .clip(CircleShape)
                            .background(
                                if (index == pagerState.currentPage) Color.White
                                else Color.White.copy(alpha = 0.4f)
                            )
                    )
                }
            }

            Spacer(Modifier.height(32.dp))

            if (pagerState.currentPage == 2) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth(0.92f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Checkbox(
                        checked = consentChecked,
                        onCheckedChange = { consentChecked = it },
                        colors = CheckboxDefaults.colors(
                            checkedColor = Color.White,
                            checkmarkColor = BrandBlue,
                            uncheckedColor = Color.White.copy(alpha = 0.8f)
                        )
                    )
                    Column {
                        Text(
                            text = stringResource(R.string.privacy_consent_prefix),
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 12.sp
                        )
                        Row {
                            TextButton(onClick = { openDoc("https://top.atqx.cn/terms") }) {
                                Text(
                                    text = stringResource(R.string.privacy_terms_link),
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            TextButton(onClick = { openDoc("https://top.atqx.cn/privacy") }) {
                                Text(
                                    text = stringResource(R.string.privacy_policy_link),
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }

            if (pagerState.currentPage < 2) {
                Button(
                    onClick = {
                        scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandBlue
                    ),
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(48.dp),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Text(
                        text = stringResource(R.string.onboarding_next),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            } else {
                Button(
                    onClick = onFinished,
                    enabled = consentChecked,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandBlue
                    ),
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(48.dp),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Text(
                        text = stringResource(R.string.onboarding_get_started),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

private data class OnboardingPage(
    val emoji: String,
    val title: String,
    val desc: String
)