import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // ✅ Always go to Desktop after login
    navigate("/desktop");

    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 12 }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
