// src/services/userService.ts

// ===============================
// TYPES
// ===============================

export interface User {
    id: string;
    name: string;
    email: string;
    password: string;
    createdAt: string;
}

export interface ActivityLog {
    userId: string;
    action: string;
    timestamp: string;
}

// ===============================
// LOCAL STORAGE KEYS
// ===============================

const USERS_KEY = "app_users";
const CURRENT_USER_KEY = "current_user";
const ACTIVITY_KEY = "user_activity_logs";

// ===============================
// HELPER FUNCTIONS
// ===============================

const getStoredUsers = (): User[] => {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
};

const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// ===============================
// REGISTER USER
// ===============================

export const registerUser = async (
    name: string,
    email: string,
    password: string
): Promise<{ success: boolean; message: string }> => {
    const users = getStoredUsers();

    const existingUser = users.find((user) => user.email === email);

    if (existingUser) {
        return { success: false, message: "User already exists" };
    }

    const newUser: User = {
        id: Date.now().toString(),
        name,
        email,
        password,
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    return { success: true, message: "User registered successfully" };
};

// ===============================
// LOGIN USER
// ===============================

export const loginUser = async (
    email: string,
    password: string
): Promise<{ success: boolean; message: string; user?: User }> => {
    const users = getStoredUsers();

    const user = users.find(
        (u) => u.email === email && u.password === password
    );

    if (!user) {
        return { success: false, message: "Invalid email or password" };
    }

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

    return { success: true, message: "Login successful", user };
};

// ===============================
// LOGOUT USER
// ===============================

export const logoutUser = async (): Promise<void> => {
    localStorage.removeItem(CURRENT_USER_KEY);
};

// ===============================
// GET CURRENT USER
// ===============================

export const getCurrentUser = (): User | null => {
    const user = localStorage.getItem(CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
};

// ===============================
// LOG USER ACTIVITY
// ===============================

export const logUserActivity = async (
    userId: string,
    action: string
): Promise<void> => {
    const logs = localStorage.getItem(ACTIVITY_KEY);
    const activityLogs: ActivityLog[] = logs ? JSON.parse(logs) : [];

    const newLog: ActivityLog = {
        userId,
        action,
        timestamp: new Date().toISOString(),
    };

    activityLogs.push(newLog);
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityLogs));
};

// ===============================
// GET USER ACTIVITY LOGS
// ===============================

export const getUserActivityLogs = (): ActivityLog[] => {
    const logs = localStorage.getItem(ACTIVITY_KEY);
    return logs ? JSON.parse(logs) : [];
};