import {
  getSupabaseHeaders,
  isSupabaseConfigured,
  supabaseUrl
} from "../lib/supabase";

const localDemoPasswordLength = 6;

export async function signUp({ email, password, fullName }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();

  if (!cleanEmail || !cleanName || password.length < localDemoPasswordLength) {
    throw new Error("Enter your name, email, and a password with 6 characters.");
  }

  if (!isSupabaseConfigured) {
    return createLocalSession(cleanEmail, cleanName);
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      email: cleanEmail,
      password,
      data: {
        full_name: cleanName
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Signup failed.");
  }

  return mapSession(data);
}

export async function signIn({ email, password }) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || password.length < localDemoPasswordLength) {
    throw new Error("Enter your email and password.");
  }

  if (!isSupabaseConfigured) {
    return createLocalSession(cleanEmail, cleanEmail.split("@")[0] || "Recipe Lover");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      email: cleanEmail,
      password
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Login failed.");
  }

  return mapSession(data);
}

export async function updateProfile({ session, fullName }) {
  const cleanName = fullName.trim();

  if (!cleanName) {
    throw new Error("Enter a profile name.");
  }

  if (!isSupabaseConfigured || session?.source === "local") {
    return {
      ...session,
      user: {
        ...session.user,
        fullName: cleanName
      }
    };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      ...getSupabaseHeaders(),
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify({
      data: {
        full_name: cleanName
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Profile update failed.");
  }

  return {
    ...session,
    user: mapUser(data)
  };
}

function createLocalSession(email, fullName) {
  return {
    accessToken: "local-demo-session",
    source: "local",
    user: {
      id: "local-demo-user",
      email,
      fullName
    }
  };
}

function mapSession(data) {
  return {
    accessToken: data.access_token,
    source: "supabase",
    user: mapUser(data.user)
  };
}

function mapUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Recipe Lover"
  };
}
