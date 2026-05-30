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

  if (!data.access_token) {
    throw new Error("Account created. Please login with your email and password.");
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

export async function updateProfile({ avatarUrl, session, fullName }) {
  const cleanName = fullName.trim();

  if (!cleanName) {
    throw new Error("Enter a profile name.");
  }

  if (!isSupabaseConfigured || session?.source === "local") {
    return {
      ...session,
      user: {
        ...session.user,
        avatarUrl: avatarUrl ?? session.user.avatarUrl,
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
        avatar_url: avatarUrl ?? session.user.avatarUrl ?? "",
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

export async function uploadAvatar({ asset, session }) {
  if (!asset?.uri) {
    throw new Error("Choose a profile photo first.");
  }

  if (!isSupabaseConfigured || session?.source === "local") {
    return asset.uri;
  }

  const extension = getFileExtension(asset.fileName || asset.uri);
  const filePath = `${session.user.id}/${Date.now()}.${extension}`;
  const fileResponse = await fetch(asset.uri);
  const fileBlob = await fileResponse.blob();
  const contentType = asset.mimeType || fileBlob.type || "image/jpeg";
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/avatars/${filePath}`,
    {
      method: "POST",
      headers: {
        apikey: getSupabaseHeaders().apikey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body: fileBlob
    }
  );

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(text || "Profile photo upload failed.");
  }

  return `${supabaseUrl}/storage/v1/object/public/avatars/${filePath}`;
}

function createLocalSession(email, fullName) {
  return {
    accessToken: "local-demo-session",
    source: "local",
    user: {
      id: "local-demo-user",
      email,
      fullName,
      avatarUrl: ""
    }
  };
}

function mapSession(data) {
  if (!data.access_token || !data.user) {
    throw new Error("Login response was incomplete. Please try again.");
  }

  return {
    accessToken: data.access_token,
    source: "supabase",
    user: mapUser(data.user)
  };
}

function mapUser(user) {
  if (!user?.id || !user?.email) {
    throw new Error("User profile was incomplete. Please login again.");
  }

  return {
    id: user.id,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url || "",
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Recipe Lover"
  };
}

function getFileExtension(value) {
  const cleanValue = value.split("?")[0];
  const extension = cleanValue.includes(".") ? cleanValue.split(".").pop() : "";
  return extension && extension.length <= 5 ? extension.toLowerCase() : "jpg";
}
