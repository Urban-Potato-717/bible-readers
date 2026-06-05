import { SettingsPanel } from "./settings-panel";

export default function SettingsPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-1">설정</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        이 기기에서의 표시와 알림을 설정합니다.
      </p>
      <SettingsPanel />
    </main>
  );
}
