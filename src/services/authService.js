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

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Signup failed.");
  }

  if (!data.access_token) {
    throw new Error("Account created. Please login with your email and password.");
  }

  const session = mapSession(data);
  await syncProfileRow(session);
  return session;
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

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Login failed.");
  }

  const session = mapSession(data);
  await syncProfileRow(session);
  return session;
}

export async function refreshSession(session) {
  if (!session?.refreshToken) {
    throw new Error("No saved login session.");
  }

  if (!isSupabaseConfigured || session?.source === "local") {
    return session;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      refresh_token: session.refreshToken
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Session refresh failed.");
  }

  const nextSession = mapSession(data);
  await syncProfileRow(nextSession);
  return nextSession;
}

export async function sendPasswordReset(email, redirectTo = "") {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error("Enter your email address first.");
  }

  if (!isSupabaseConfigured) {
    return;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      email: cleanEmail,
      ...(redirectTo ? { redirect_to: redirectTo } : {})
    })
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Password reset failed.");
  }
}

export async function updatePasswordWithRecovery({ accessToken, password }) {
  if (!accessToken) {
    throw new Error("Password reset link is missing a recovery token.");
  }

  if (password.length < localDemoPasswordLength) {
    throw new Error("Enter a new password with 6 characters.");
  }

  if (!isSupabaseConfigured) {
    return;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      ...getSupabaseHeaders(),
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      password
    })
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Password update failed.");
  }
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
        full_name: cleanName,
        subscription_preview: Boolean(session.user.hasSubscriptionPreview)
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Profile update failed.");
  }

  const updatedSession = {
    ...session,
    user: mapUser(data)
  };

  await syncProfileRow(updatedSession);
  return updatedSession;
}

export async function updateSubscriptionPreview({ isActive, session }) {
  if (!session) {
    throw new Error("Login first to unlock premium.");
  }

  if (!isSupabaseConfigured || session?.source === "local") {
    return {
      ...session,
      user: {
        ...session.user,
        hasSubscriptionPreview: isActive
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
        avatar_url: session.user.avatarUrl ?? "",
        full_name: session.user.fullName,
        subscription_preview: isActive
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "Subscription update failed.");
  }

  const updatedSession = {
    ...session,
    user: mapUser(data)
  };

  await syncProfileRow(updatedSession);
  return updatedSession;
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
    expiresAt: null,
    refreshToken: "",
    source: "local",
    user: {
      id: "local-demo-user",
      email,
      fullName,
      avatarUrl: "",
      hasSubscriptionPreview: false
    }
  };
}

function mapSession(data) {
  if (!data.access_token || !data.user) {
    throw new Error("Login response was incomplete. Please try again.");
  }

  return {
    accessToken: data.access_token,
    expiresAt: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    refreshToken: data.refresh_token || "",
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
    hasSubscriptionPreview:
      user.user_metadata?.subscription_preview === true ||
      user.user_metadata?.subscription_preview === "true",
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Recipe Lover"
  };
}

async function syncProfileRow(session) {
  if (!isSupabaseConfigured || !session || session.source === "local") {
    return;
  }

  const profile = {
    avatar_url: session.user.avatarUrl || null,
    email: session.user.email,
    full_name: session.user.fullName,
    subscription_preview: Boolean(session.user.hasSubscriptionPreview),
    updated_at: new Date().toISOString(),
    user_id: session.user.id
  };

  try {
    await upsertProfile(profile, session.accessToken);
  } catch {
    try {
      await upsertProfile({
        avatar_url: profile.avatar_url,
        full_name: profile.full_name,
        updated_at: profile.updated_at,
        user_id: profile.user_id
      }, session.accessToken);
    } catch {
      // Auth metadata remains the source of truth if the optional profile table is not ready.
    }
  }
}

async function upsertProfile(profile, accessToken) {
  const response = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      Authorization: `Bearer ${accessToken}`,
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Profile sync failed.");
  }
}

function getFileExtension(value) {
  const cleanValue = value.split("?")[0];
  const extension = cleanValue.includes(".") ? cleanValue.split(".").pop() : "";
  return extension && extension.length <= 5 ? extension.toLowerCase() : "jpg";
}
