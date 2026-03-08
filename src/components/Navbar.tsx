import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, FileSpreadsheet } from "lucide-react";

export default function Navbar() {
  const { user, loginWithGoogle, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-white/80 backdrop-blur-md border-b border-neutral-200/80">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
          <FileSpreadsheet className="text-white" size={15} />
        </div>
        <span className="text-sm font-semibold text-neutral-900 tracking-tight">SheetsLite</span>
      </div>

      <div>
        {user ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-neutral-500">{user.displayName}</span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold border-2 border-white shadow-sm"
              style={{ backgroundColor: user.cursorColor }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 transition-colors ml-1"
            >
              <LogOut size={15} />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="flex items-center gap-2 bg-neutral-900 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            <LogIn size={15} />
            Sign in with Google
          </button>
        )}
      </div>
    </nav>
  );
}