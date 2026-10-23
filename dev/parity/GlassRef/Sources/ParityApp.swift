import SwiftUI
import WebKit

@main
struct ParityApp: App {
  var body: some Scene {
    WindowGroup { RootView() }
  }
}

struct RootView: View {
  @State private var tab: Int = {
    let args = CommandLine.arguments
    if args.contains("-webcontrols") { return 2 }
    if args.contains("-web") { return 2 }
    if args.contains("-controls") { return 1 }
    return 0
  }()
  var body: some View {
    TabView(selection: $tab) {
      CardScene()
        .tag(0)
        .toolbar(.hidden, for: .tabBar)
      ControlsColumn()
        .tag(1)
        .toolbar(.hidden, for: .tabBar)
      WebScene()
        .tag(2)
        .toolbar(.hidden, for: .tabBar)
    }
    .ignoresSafeArea()
    .persistentSystemOverlays(.hidden)
  }
}

// Loads a loose bundle resource as an image.
struct BundleImage: View {
  var name: String
  var ext: String
  var body: some View {
    if let path = Bundle.main.path(forResource: name, ofType: ext),
       let image = UIImage(contentsOfFile: path) {
      Image(uiImage: image).resizable().scaledToFill()
    } else {
      Color(red: 1, green: 0, blue: 1)
    }
  }
}

// MARK: - Backdrops matching the parity test card

enum Backdrop {
  case color(Color)
  case split(Color, Color)
  case photo

  @ViewBuilder
  var view: some View {
    switch self {
    case .color(let c):
      c
    case .split(let a, let b):
      HStack(spacing: 0) { a; b }
    case .photo:
      BundleImage(name: "street", ext: "jpg")
    }
  }
}

// A capsule of real iOS 26 glass, pinned to an appearance.
struct GlassCapsule: View {
  var scheme: ColorScheme
  var label: String? = nil

  var body: some View {
    ZStack {
      if let label {
        Text(label)
          .font(.system(size: 15, weight: .medium))
          .foregroundStyle(.primary)
      }
    }
    .frame(width: 158, height: 54)
    .glassEffect(.regular, in: .capsule)
    .environment(\.colorScheme, scheme)
  }
}

// One card row: backdrop with dark-appearance capsule left, light-appearance right.
struct BackdropRow: View {
  var backdrop: Backdrop
  var height: CGFloat = 84
  var label: String? = nil

  var body: some View {
    backdrop.view
      .frame(maxWidth: .infinity)
      .frame(height: height)
      .clipped()
      .overlay {
        HStack(spacing: 0) {
          GlassCapsule(scheme: .dark, label: label)
            .frame(maxWidth: .infinity)
          GlassCapsule(scheme: .light, label: label)
            .frame(maxWidth: .infinity)
        }
      }
  }
}

struct CardScene: View {
  var body: some View {
    ScrollView(.vertical, showsIndicators: false) {
      VStack(spacing: 0) {
        Color.clear.frame(height: 62)
        BackdropRow(backdrop: .color(Color(white: 0.0)))
        BackdropRow(backdrop: .color(Color(white: 43.0 / 255.0)))
        BackdropRow(backdrop: .color(Color(white: 128.0 / 255.0)))
        BackdropRow(backdrop: .color(.white))
        BackdropRow(backdrop: .color(Color(red: 1, green: 0, blue: 0)))
        BackdropRow(backdrop: .color(Color(red: 0, green: 0, blue: 1)))
        BackdropRow(backdrop: .split(Color(white: 0.0), .white))
        BackdropRow(backdrop: .photo, height: 96)
        BackdropRow(backdrop: .photo, height: 96, label: "Week")
      }
    }
    .ignoresSafeArea()
    .background(.black)
  }
}

// MARK: - Controls scene matching the playground's refraction stage

struct ControlsScene: View {
  var scheme: ColorScheme
  @State private var range = "week"
  @State private var query = ""

  var body: some View {
    BundleImage(name: scheme == .light ? "tahoe-light" : "tahoe-dark", ext: "webp")
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .clipped()
      .overlay {
        VStack(spacing: 20) {
          Picker("Range", selection: $range) {
            Text("Day").tag("day")
            Text("Week").tag("week")
            Text("Month").tag("month")
          }
          .pickerStyle(.segmented)
          .frame(width: 260)

          HStack(spacing: 16) {
            Button {} label: {
              Image(systemName: "square.and.arrow.up")
                .font(.system(size: 17, weight: .medium))
                .frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)

            Button("Continue") {}
              .buttonStyle(.glass)
          }

          TextField("Search", text: $query)
            .textFieldStyle(.plain)
            .padding(.horizontal, 14)
            .padding(.leading, 22)
            .frame(width: 280, height: 44)
            .glassEffect(.regular, in: .capsule)
            .overlay(alignment: .leading) {
              Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .padding(.leading, 16)
            }
        }
        .environment(\.colorScheme, scheme)
      }
  }
}

struct ControlsColumn: View {
  var body: some View {
    VStack(spacing: 0) {
      ControlsScene(scheme: .dark)
      ControlsScene(scheme: .light)
    }
    .ignoresSafeArea()
  }
}

// MARK: - Web harness inside the same app

struct WebScene: View {
  var body: some View {
    WebView()
      .ignoresSafeArea()
      .background(.black)
  }
}

struct WebView: UIViewRepresentable {
  func makeUIView(context: Context) -> WKWebView {
    let webView = WKWebView()
    webView.isOpaque = false
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.scrollView.bounces = false
    if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
      webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
    if CommandLine.arguments.contains("-webcontrols") {
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
        webView.evaluateJavaScript("window.scrollTo(0, 842)", completionHandler: nil)
      }
    }
    return webView
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {}
}
