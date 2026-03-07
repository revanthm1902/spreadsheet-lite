import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, FileSpreadsheet } from "lucide-react";

export default function Navbar() {
  const { user, loginWithGoogle, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="text-green-600" size={28} />
        <span className="text-xl font-semibold text-gray-800">SheetsPro</span>
      </div>
      
      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: user.cursorColor }}
              >
                {user.displayName.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-700">{user.displayName}</span>
            </div>
            <button onClick={logout} className="p-2 text-gray-500 hover:text-gray-800 transition">
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <button 
            onClick={loginWithGoogle}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            <LogIn size={18} />
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}