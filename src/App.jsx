import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

const Gallery = lazy(() => import('./pages/Gallery'));
const Chat = lazy(() => import('./pages/Chat'));
const CreateCharacter = lazy(() => import('./pages/CreateCharacter'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const MyBots = lazy(() => import('./pages/MyBots'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Members = lazy(() => import('./pages/Members'));
const Help = lazy(() => import('./pages/Help'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const GroupChat = lazy(() => import('./pages/GroupChat'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (!loading && !user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { loading } = useAuth();

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout authLoading={loading} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Gallery />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="my-bots" element={<MyBots />} />
          <Route path="members" element={<Members />} />
          <Route path="create" element={<CreateCharacter />} />
          <Route path="chat/:characterId" element={<Chat />} />
          <Route path="group/:groupId" element={<GroupChat />} />
          <Route path="profile/:userId" element={<Profile />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="help" element={<Help />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
