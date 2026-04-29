import React, {
    createContext, useContext, useState,
    useEffect, useCallback, ReactNode
} from "react";
import axios from "axios";
import { getUser, isAuthenticated, verifyToken, clearAuthData } from "../services/authService";
import { clearStoredCart, getStoredCartItems } from "../services/cartStorage";
import type { User } from "../types/auth";

// 1. Add cartCount + refreshCartCount to the type
interface AuthContextType {
    user: User | null;
    isAuth: boolean;
    loading: boolean;
    cartCount: number;
    setUser: (user: User | null) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
    refreshCartCount: (uid?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [cartCount, setCartCount] = useState(0); // 2. New state

    // 3. refreshCartCount function
    const refreshCartCount = useCallback(async (uid?: string) => {
        if (!uid) {
            const local = getStoredCartItems();
            setCartCount(local.reduce((sum, item) => sum + item.quantity, 0));
            return;
        }
        try {
            const res = await axios.get(`http://localhost:5000/api/cart/${uid}`);
            const total = (res.data.items || []).reduce(
                (sum: number, item: any) => sum + item.quantity, 0
            );
            setCartCount(total);
        } catch {
            setCartCount(0);
        }
    }, []);

    const checkAuth = async () => {
        try {
            if (isAuthenticated()) {
                const storedUser = getUser();
                if (storedUser) {
                    const verifyResult = await verifyToken();
                    if (verifyResult.success && verifyResult.valid) {
                        setUser(storedUser);
                    } else {
                        clearAuthData();
                        setUser(null);
                    }
                }
            }
        } catch (error) {
            console.error("Error checking auth:", error);
            clearAuthData();
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    // 4. Refresh count whenever user changes (login/logout/mount)
    useEffect(() => {
        refreshCartCount(user?.id);
    }, [user?.id, refreshCartCount]);

    const logout = () => {
        clearAuthData();
        clearStoredCart();
        setUser(null);
        setCartCount(0); // Reset badge on logout
    };

    // 5. Export cartCount + refreshCartCount
    const value: AuthContextType = {
        user,
        isAuth: !!user,
        loading,
        cartCount,
        setUser,
        logout,
        checkAuth,
        refreshCartCount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};