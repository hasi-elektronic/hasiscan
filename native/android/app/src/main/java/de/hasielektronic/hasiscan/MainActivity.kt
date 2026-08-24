package de.hasielektronic.hasiscan

import android.Manifest
import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var pendingPermission: PermissionRequest? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val requestCamera =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pendingPermission
            pendingPermission = null
            if (request == null) return@registerForActivityResult
            val video = request.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
            if (granted && video.isNotEmpty()) {
                request.grant(video.toTypedArray())
            } else {
                request.deny()
            }
        }

    private val fileChooser =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            filePathCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else emptyArray())
            filePathCallback = null
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        val assetLoader =
            WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", AssetFallbackHandler())
                .build()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = true
        webView.settings.builtInZoomControls = false
        webView.settings.displayZoomControls = false
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.userAgentString = webView.settings.userAgentString + " HasiScanNative/1.0"
        webView.settings.setSupportMultipleWindows(false)

        webView.webViewClient =
            object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
            }

        webView.webChromeClient =
            object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    pendingPermission = request
                    requestCamera.launch(Manifest.permission.CAMERA)
                }

                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams,
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback
                    val accept = fileChooserParams.acceptTypes.firstOrNull().orEmpty()
                    fileChooser.launch(if (accept.isBlank()) "image/*" else accept)
                    return true
                }
            }

        webView.loadUrl("https://appassets.androidplatform.net/")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    private inner class AssetFallbackHandler : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val clean = path.trim('/').ifBlank { "index.html" }
            val direct = openAsset(clean)
            if (direct != null) return direct
            if (looksLikeFile(clean)) return null
            return openAsset("index.html")
        }

        private fun looksLikeFile(path: String): Boolean {
            val last = path.substringAfterLast('/')
            return last.contains('.')
        }

        private fun openAsset(name: String): WebResourceResponse? {
            return try {
                val stream = assets.open(name)
                val ext = name.substringAfterLast('.', "")
                val mime =
                    MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
                        ?: when (ext) {
                            "js", "mjs" -> "text/javascript"
                            "css" -> "text/css"
                            "json", "webmanifest" -> "application/json"
                            "svg" -> "image/svg+xml"
                            "html", "htm" -> "text/html"
                            "wasm" -> "application/wasm"
                            else -> "application/octet-stream"
                        }
                WebResourceResponse(mime, "utf-8", stream)
            } catch (_: Exception) {
                null
            }
        }
    }
}
