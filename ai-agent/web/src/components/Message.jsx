import { useState } from "react";
import Icon from "./Icon.jsx";
import Markdown from "./Markdown.jsx";
import { AgentAvatar } from "./ui.jsx";

const STATUS_TEXT = {
  thinking: "يفكّر",
  writing: "يكتب",
  web_search: "يبحث في الإنترنت",
  compacting: "يلخّص بداية المحادثة",
  sending: "يرسل",
};
const TOOL_TEXT = {
  list_folder: "يتصفّح المجلد",
  search_folder: "يبحث في ملفاتك",
  read_folder_file: "يقرأ ملفًا من جهازك",
};
export const statusLabel = (s) => (s?.kind === "tool" ? s.label || TOOL_TEXT[s.name] || "يستخدم أداة" : STATUS_TEXT[s?.kind] || "يفكّر");

function FileChips({ files }) {
  if (!files?.length) return null;
  return (
    <div className="file-chips">
      {files.map((f) => (
        <span key={f.id} className="file-chip">
          <Icon name={f.kind === "image" ? "sparkle" : "file"} size={14} />
          <span className="file-chip-name">{f.name}</span>
        </span>
      ))}
    </div>
  );
}

function ToolTrail({ tools }) {
  const [open, setOpen] = useState(false);
  if (!tools?.length) return null;
  return (
    <div className="tool-trail">
      <button className="tool-trail-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="search" size={14} /> {tools.length === 1 ? "خطوة واحدة" : `${tools.length} خطوات`} قبل الرد
      </button>
      {open && (
        <ul>
          {tools.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}

export function UserMessage({ item }) {
  return (
    <div className="msg msg-user">
      <div className="bubble">
        <FileChips files={item.files} />
        {item.text && <div className="user-text" dir="auto">{item.text}</div>}
        {item.voice && <span className="voice-tag"><Icon name="mic" size={12} /> صوتي</span>}
      </div>
    </div>
  );
}

export function AssistantMessage({ item, agent, live, speaking, onSpeak, onStopSpeak, canSpeak }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="msg msg-assistant">
      <AgentAvatar name={agent?.name} gender={agent?.gender} size={30} />
      <div className="msg-body">
        <ToolTrail tools={item.tools} />
        {item.text ? <Markdown text={item.text} /> : null}
        {live && (
          <div className="live-status">
            <span className="dots"><i /><i /><i /></span> {statusLabel(live.status)}
          </div>
        )}
        {item.error && <div className="msg-error"><Icon name="alert" size={16} /> {item.error}</div>}
        {!live && item.text && (
          <div className="msg-actions">
            <button className="icon-btn sm" onClick={copy} aria-label="نسخ الرد" title="نسخ">
              <Icon name={copied ? "check" : "copy"} size={16} />
            </button>
            {canSpeak && (
              speaking ? (
                <button className="icon-btn sm is-on" onClick={onStopSpeak} aria-label="إيقاف القراءة" title="إيقاف">
                  <Icon name="stop" size={16} />
                </button>
              ) : (
                <button className="icon-btn sm" onClick={onSpeak} aria-label="اقرأ الرد بصوت" title="استمع">
                  <Icon name="speaker" size={16} />
                </button>
              )
            )}
            {item.stopped && <span className="muted small">أُوقف</span>}
          </div>
        )}
      </div>
    </div>
  );
}
