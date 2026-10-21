import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./lib/api.js";
import { speaker } from "./lib/speech.js";
import Login from "./components/Login.jsx";
import ChangePassword from "./components/ChangePassword.jsx";
import TwoFactorSetup from "./components/TwoFactorSetup.jsx";
import Shell from "./components/Shell.jsx";
import { ToastHost } from "./components/ui.jsx";

const MeCtx = createContext(null);
export const useMe = () => useContext(MeCtx);

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = جارٍ التحميل، null = غير مسجّل

  const refresh = useCallback(async () => {
    try {
      const data = await api("/auth/me");
      // جلسة قديمة بلا تحقق لحساب فعّل التحقق: يلزم دخول جديد
      if (data.security?.totpEnabled && !data.security?.mfa) {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        setMe(null);
        return null;
      }
      setMe(data);
      return data;
    } catch (err) {
      if (err.status === 401) setMe(null);
      else setMe((m) => m ?? null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => setMe(null);
    window.addEventListener("sq-auth-expired", onExpired);
    return () => window.removeEventListener("sq-auth-expired", onExpired);
  }, [refresh]);

  // إعداد الصوت حسب المساعد والتفضيلات
  useEffect(() => {
    if (!me?.user) return;
    speaker.configure({
      cloud: me.org.cloudVoice,
      gender: me.user.agent?.gender || "male",
      lang: me.user.prefs?.speechLang || "ar-SA",
      rate: me.user.prefs?.voiceRate || 1,
      voiceName: me.user.prefs?.browserVoice || "",
    });
  }, [me]);

  const logout = async () => {
    speaker.stop();
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.hash = "";
    setMe(null);
  };

  let view;
  if (me === undefined) view = <div className="splash"><div className="spinner" /></div>;
  else if (!me) view = <Login onDone={refresh} />;
  else if (me.user.mustChangePassword) view = <ChangePassword forced onDone={refresh} onLogout={logout} />;
  else if (!me.security?.mfa) view = <TwoFactorSetup onDone={refresh} onLogout={logout} />;
  else view = <Shell />;

  return (
    <MeCtx.Provider value={{ me, setMe, refresh, logout }}>
      {view}
      <ToastHost />
    </MeCtx.Provider>
  );
}
