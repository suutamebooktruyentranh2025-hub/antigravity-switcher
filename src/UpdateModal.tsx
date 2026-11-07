import { useEffect, useState } from "react";
import {
  downloadUpdate,
  installUpdateAndRelaunch,
  listenUpdateProgress,
  type UpdateCheckResult,
  type UpdateProgress,
} from "./api";
import { translate, type Locale, type MessageKey } from "./locale";

interface UpdateModalProps {
  update_info: UpdateCheckResult;
  locale: Locale;
  onClose: () => void;
}

type UpdateStatus = "idle" | "downloading" | "installing" | "error";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function UpdateModal({ update_info, locale, onClose }: UpdateModalProps) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState<UpdateProgress>({ percent: 0, downloaded: 0, total: 0 });
  const [error_message, setErrorMessage] = useState<string | null>(null);

  const t = (key: MessageKey, values?: Record<string, string>) => translate(locale, key, values);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenUpdateProgress((p) => {
      setProgress(p);
    }).then((stop) => {
      unlisten = stop;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  async function onStartUpdate() {
    if (!update_info.download_url || !update_info.file_name) {
      setErrorMessage("Không tìm thấy link tải bản cập nhật");
      setStatus("error");
      return;
    }
    setStatus("downloading");
    setErrorMessage(null);
    try {
      const file_path = await downloadUpdate(update_info.download_url, update_info.file_name);
      setStatus("installing");
      await installUpdateAndRelaunch(file_path);
    } catch (err) {
      setStatus("error");
      setErrorMessage(String(err));
    }
  }

  return (
    <div className="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget && status === "idle") onClose(); }}>
      <div className="dialog update-dialog" role="dialog" aria-modal="true" aria-label={t("update_available", { version: update_info.remote_version })}>
        <h2>{t("update_available", { version: update_info.remote_version })}</h2>
        <p className="muted update-version-diff">
          <span>v{update_info.current_version}</span> → <strong className="new-version">v{update_info.remote_version}</strong>
        </p>

        {update_info.changelog ? (
          <div className="update-changelog-section">
            <p className="field-label">{t("release_notes")}</p>
            <div className="update-changelog-box">
              {update_info.changelog}
            </div>
          </div>
        ) : null}

        {status === "downloading" ? (
          <div className="update-progress-container">
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="progress-info-row">
              <span>{t("update_downloading", { percent: Math.round(progress.percent).toString() })}</span>
              <span className="muted">{formatBytes(progress.downloaded)} / {formatBytes(progress.total)}</span>
            </div>
          </div>
        ) : null}

        {status === "installing" ? (
          <div className="update-installing-status">
            <span className="spinner" aria-hidden="true" />
            <span>{t("update_installing")}</span>
          </div>
        ) : null}

        {status === "error" && error_message ? (
          <p className="error-text">{t("update_failed", { error: error_message })}</p>
        ) : null}

        <div className="dialog-actions">
          {status === "idle" ? (
            <>
              <button className="action-button secondary" onClick={onClose}>
                {t("update_later")}
              </button>
              <button className="action-button primary" onClick={() => void onStartUpdate()}>
                {t("update_now")}
              </button>
            </>
          ) : null}

          {status === "error" ? (
            <>
              <button className="action-button secondary" onClick={onClose}>
                {t("close")}
              </button>
              <button className="action-button primary" onClick={() => void onStartUpdate()}>
                {t("update_now")}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

