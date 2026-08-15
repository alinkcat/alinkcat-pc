package com.ailinkcat.mobile.ui.login

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ailinkcat.mobile.ui.theme.BrandBlue
import com.ailinkcat.mobile.ui.theme.BrandPurple
import com.ailinkcat.mobile.viewmodel.LoginViewModel

/**
 * 登录页：品牌展示 + 账号密码表单。
 *
 * @param onLoginSuccess 登录成功后的回调（跳转主页等）
 */
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    loginViewModel: LoginViewModel = viewModel()
) {
    val uiState by loginViewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current

    // ── 密码显隐切换 ──────────────────────────────────────
    var passwordVisible by remember { mutableStateOf(false) }

    // ── 登录成功回调 ──────────────────────────────────────
    LaunchedEffect(uiState.isLoginSuccess) {
        if (uiState.isLoginSuccess) {
            onLoginSuccess()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        BrandBlue.copy(alpha = 0.08f),
                        BrandPurple.copy(alpha = 0.12f),
                        MaterialTheme.colorScheme.background
                    ),
                    startY = 0f,
                    endY = 800f
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── 顶部品牌区 ────────────────────────────────
            Spacer(Modifier.height(80.dp))

            // Logo 图标
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.verticalGradient(listOf(BrandBlue, BrandPurple))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(R.drawable.ic_logo),
                    contentDescription = null,
                    modifier = Modifier.size(56.dp),
                    contentScale = ContentScale.Fit
                )
            }

            Spacer(Modifier.height(20.dp))

            Text(
                text = "艾联猫",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(Modifier.height(4.dp))

            Text(
                text = "PC 桌面伴侣 · 副屏监控 · DIY 桌面",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(48.dp))

            // ── 表单区 ────────────────────────────────────
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 1.dp,
                shadowElevation = 2.dp
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "登录",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(Modifier.height(4.dp))

                    // 账号输入框
                    OutlinedTextField(
                        value = uiState.username,
                        onValueChange = { loginViewModel.updateUsername(it) },
                        label = { Text("账号 / 邮箱") },
                        placeholder = { Text("请输入账号或邮箱") },
                        singleLine = true,
                        enabled = !uiState.isLoading && uiState.lockSeconds == 0,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        )
                    )

                    // 密码输入框
                    OutlinedTextField(
                        value = uiState.password,
                        onValueChange = { loginViewModel.updatePassword(it) },
                        label = { Text("密码") },
                        placeholder = { Text("请输入密码") },
                        singleLine = true,
                        enabled = !uiState.isLoading && uiState.lockSeconds == 0,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        visualTransformation = if (passwordVisible) {
                            VisualTransformation.None
                        } else {
                            PasswordVisualTransformation()
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                loginViewModel.login(onLoginSuccess)
                            }
                        ),
                        trailingIcon = {
                            Text(
                                text = if (passwordVisible) "🙈" else "👁️",
                                modifier = Modifier
                                    .clickable(enabled = !uiState.isLoading) {
                                        passwordVisible = !passwordVisible
                                    }
                                    .padding(8.dp),
                                fontSize = 18.sp
                            )
                        }
                    )

                    // ── 错误提示 + 429 锁定倒计时 ──────────
                    AnimatedVisibility(
                        visible = uiState.errorMessage != null || uiState.lockSeconds > 0,
                        enter = fadeIn(),
                        exit = fadeOut()
                    ) {
                        val displayText = if (uiState.lockSeconds > 0) {
                            val minutes = uiState.lockSeconds / 60
                            val seconds = uiState.lockSeconds % 60
                            "登录尝试过于频繁，请 ${minutes}分${seconds}秒 后重试"
                        } else {
                            uiState.errorMessage ?: ""
                        }
                        Text(
                            text = displayText,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Start
                        )
                    }

                    Spacer(Modifier.height(4.dp))

                    // 登录按钮
                    Button(
                        onClick = {
                            focusManager.clearFocus()
                            loginViewModel.login(onLoginSuccess)
                        },
                        enabled = !uiState.isLoading && uiState.lockSeconds == 0,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = BrandBlue,
                            disabledContainerColor = BrandBlue.copy(alpha = 0.5f)
                        )
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(12.dp))
                            Text("登录中...")
                        } else {
                            Text(
                                text = "登  录",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            // ── 底部提示 ──────────────────────────────────
            Text(
                text = "首次使用？连接 PC 端后即可通过扫码快速配置",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(Modifier.height(32.dp))
        }
    }
}