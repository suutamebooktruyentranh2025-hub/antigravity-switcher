pub fn send_notification(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let safe_title = title.replace('\\', "\\\\").replace('"', "\\\"");
        let safe_body = body.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!("display notification \"{safe_body}\" with title \"{safe_title}\"");
        let _ = Command::new("osascript")
            .args(["-e", &script])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let safe_title = title.replace('"', "`\"");
        let safe_body = body.replace('"', "`\"");
        let script = format!(
            "[reflection.assembly]::loadwithpartialname('System.Windows.Forms'); [reflection.assembly]::loadwithpartialname('System.Drawing'); $notify = new-object system.windows.forms.notifyicon; $notify.icon = [system.drawing.systemicons]::Information; $notify.visible = $true; $notify.showballoontip(10, \"{safe_title}\", \"{safe_body}\", [system.windows.forms.tooltipicon]::Warning)"
        );
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }
}
