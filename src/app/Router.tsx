import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router'
import { AuthLayout } from './layouts/AuthLayout'
import { AppLayout } from './layouts/AppLayout'
import { AuthGuard } from './guards/AuthGuard'

import { Splash } from './screens/Splash'
import { TheBoard } from './screens/TheBoard'
import { BetDetail } from './screens/BetDetail'
import { ProofSubmission } from './screens/ProofSubmission'
import { ShameProofSubmission } from './screens/ShameProofSubmission'
import { OutcomeReveal } from './screens/OutcomeReveal'
import { OutcomeWin } from './screens/OutcomeWin'
import { Competitions } from './screens/Competitions'
import { ProfileScreen } from './screens/ProfileScreen'
import { SignUpScreen } from './screens/SignUpScreen'
import { LoginScreen } from './screens/LoginScreen'
import { OTPScreen } from './screens/OTPScreen'
import { AuthCallbackScreen } from './screens/AuthCallbackScreen'
import { ProfileSetupScreen } from './screens/ProfileSetupScreen'
import { GroupJoinScreen } from './screens/GroupJoinScreen'
import { GroupCreateScreen } from './screens/GroupCreateScreen'
import { GroupJoinByCodeScreen } from './screens/GroupJoinByCodeScreen'
import { GroupDetailScreen } from './screens/GroupDetailScreen'
import { ProfileEditScreen } from './screens/ProfileEditScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { CompetitionCreateScreen } from './screens/CompetitionCreateScreen'
import { PunishmentStatsScreen } from './screens/PunishmentStatsScreen'
import { PlayerCardScreen } from './screens/PlayerCardScreen'
import { RematchScreen } from './screens/RematchScreen'
import { ChatInboxScreen } from './screens/ChatInboxScreen'
import { ChatConversationScreen } from './screens/ChatConversationScreen'
import { JournalScreen } from './screens/JournalScreen'
import { JournalDetailScreen } from './screens/JournalDetailScreen'
import { GroupJournalScreen } from './screens/GroupJournalScreen'
import { ArchiveScreen } from './screens/ArchiveScreen'
import { FeedbackScreen } from './screens/FeedbackScreen'
import { CompetitionInviteScreen } from './screens/CompetitionInviteScreen'
import { RosterScreen } from './screens/RosterScreen'
import { PublicProfileScreen } from './screens/PublicProfileScreen'
import { InviteAcceptScreen } from './screens/InviteAcceptScreen'
import { GroupCreateMembersScreen } from './screens/GroupCreateMembersScreen'
import { BrowseSuggestionsScreen } from './screens/BrowseSuggestionsScreen'
import { OnboardingInterestsScreen } from './screens/OnboardingInterestsScreen'

// Wrappers adapt callback-prop screens for router navigation
function SplashRoute() {
  const navigate = useNavigate()
  return (
    <Splash
      onEnter={() => navigate('/auth/signup')}
      onLogin={() => navigate('/auth/login')}
    />
  )
}

function BetCreateRoute() {
  // /bet/create redirects to /compete/create so location.state (templateBetId) is preserved
  return <CompetitionCreateScreen />
}

function ProfileScreenWithId() {
  const { id } = useParams<{ id: string }>()
  return <ProfileScreen userId={id} />
}

function BetDetailRoute() {
  const navigate = useNavigate()
  return <BetDetail onBack={() => navigate(-1)} />
}

function ProofSubmissionRoute() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  return (
    <ProofSubmission
      onSubmit={() => id && navigate(`/bet/${id}`)}
      onBack={() => navigate(-1)}
    />
  )
}

function CompeteProofSubmissionRoute() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  return (
    <ProofSubmission
      onSubmit={() => id && navigate(`/compete/${id}`)}
      onBack={() => navigate(-1)}
    />
  )
}

function CompeteOutcomeRevealRoute() {
  const navigate = useNavigate()
  return (
    <OutcomeReveal
      // Hall of Shame page retired — share navigates to Player Card instead
      onShare={() => navigate('/profile/card')}
      onBack={() => navigate('/compete')}
    />
  )
}

function OutcomeRevealRoute() {
  const navigate = useNavigate()
  return (
    <OutcomeReveal
      // Hall of Shame page retired — share navigates to Player Card instead
      onShare={() => navigate('/profile/card')}
      onBack={() => navigate('/home')}
    />
  )
}

function OutcomeWinRoute() {
  const navigate = useNavigate()
  return (
    <OutcomeWin
      // Hall of Shame page retired — share navigates to Player Card instead
      onShare={() => navigate('/profile/card')}
      onBack={() => navigate('/home')}
    />
  )
}

function PublicProfileRoute() {
  const { username } = useParams<{ username: string }>()
  return <PublicProfileScreen username={username!} />
}

function InviteAcceptRoute() {
  const { code } = useParams<{ code: string }>()
  return <InviteAcceptScreen code={code!} />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ---- PUBLIC (no auth required) ---- */}
        <Route element={<AuthLayout />}>
          <Route index element={<SplashRoute />} />
          <Route path="auth/signup" element={<SignUpScreen />} />
          <Route path="auth/login" element={<LoginScreen />} />
          <Route path="auth/email" element={<Navigate to="/auth/login" replace />} />
          <Route path="auth/phone" element={<Navigate to="/auth/login" replace />} />
          <Route path="auth/callback" element={<AuthCallbackScreen />} />
          <Route path="auth/otp" element={<OTPScreen />} />
          <Route path="auth/profile-setup" element={<ProfileSetupScreen />} />
          <Route path="onboarding/interests" element={<OnboardingInterestsScreen />} />
          {/* Competition invite — public so unauthenticated users can land here */}
          <Route path="invite/compete/:compId" element={<CompetitionInviteScreen />} />
          {/* Friend invite — public so unauthenticated users can land here */}
          <Route path="add/:code" element={<InviteAcceptRoute />} />
          {/* Public player card — viewable without auth (stranger state) */}
          <Route path="u/:username" element={<PublicProfileRoute />} />
        </Route>

        {/* ---- PROTECTED (requires auth) ---- */}
        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            {/* Home / The Board */}
            <Route path="home" element={<TheBoard />} />

            {/* Bets */}
            <Route path="bet/create" element={<BetCreateRoute />} />
            <Route path="bet/:id" element={<BetDetailRoute />} />
            <Route path="bet/:id/proof" element={<ProofSubmissionRoute />} />
            <Route path="bet/:id/shame-proof" element={<ShameProofSubmission />} />
            <Route path="bet/:id/outcome" element={<OutcomeRevealRoute />} />
            <Route path="bet/:id/win" element={<OutcomeWinRoute />} />
            <Route path="bet/:id/forfeit" element={<OutcomeRevealRoute />} />
            <Route path="bet/:id/rematch" element={<RematchScreen />} />

            {/* Competition (merged with former H2H) */}
            <Route path="compete" element={<Competitions />} />
            <Route path="compete/create" element={<CompetitionCreateScreen />} />
            <Route path="compete/:id" element={<BetDetailRoute />} />
            <Route path="compete/:id/proof" element={<CompeteProofSubmissionRoute />} />
            <Route path="compete/:id/shame-proof" element={<ShameProofSubmission />} />
            <Route path="compete/:id/outcome" element={<CompeteOutcomeRevealRoute />} />
            <Route path="compete/:id/win" element={<OutcomeWinRoute />} />
            <Route path="compete/:id/forfeit" element={<CompeteOutcomeRevealRoute />} />
            <Route path="compete/:id/rematch" element={<RematchScreen />} />

            {/* Journal (replaces Record in nav) */}
            <Route path="journal" element={<JournalScreen />} />
            <Route path="journal/:id" element={<JournalDetailScreen />} />
            <Route path="journal/group/:groupId" element={<GroupJournalScreen />} />

            {/* Archive */}
            <Route path="archive" element={<ArchiveScreen />} />

            {/* Hall of Shame retired — /shame now redirects to home.
                RecordScreen and useShameStore are kept in the codebase for
                future re-use (e.g. group punishment leaderboards) but are no
                longer reachable as a top-level page. Creative punishments are
                surfaced directly on Player Cards and Bet Detail instead. */}
            <Route path="shame" element={<Navigate to="/home" replace />} />
            <Route path="stats" element={<Navigate to="/home" replace />} />

            {/* Profile */}
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="profile/:id" element={<ProfileScreenWithId />} />
            <Route path="profile/edit" element={<ProfileEditScreen />} />

            {/* Friend invite (authenticated — full accept flow) */}
            <Route path="add/:code" element={<InviteAcceptRoute />} />

            {/* Groups */}
            <Route path="group/:id" element={<GroupDetailScreen />} />
            <Route path="group/create" element={<GroupCreateScreen />} />
            <Route path="group/create/members" element={<GroupCreateMembersScreen />} />
            <Route path="group/join" element={<GroupJoinScreen />} />
            <Route path="group/join/:code" element={<GroupJoinByCodeScreen />} />

            {/* Chat */}
            <Route path="chat" element={<ChatInboxScreen />} />
            <Route path="chat/:conversationId" element={<ChatConversationScreen />} />

            {/* Settings & Punishments */}
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="feedback" element={<FeedbackScreen />} />
            <Route path="punishment/:id" element={<PunishmentStatsScreen />} />

            {/* Player Card */}
            <Route path="profile/card" element={<PlayerCardScreen />} />

            {/* Suggestions */}
            <Route path="suggestions" element={<BrowseSuggestionsScreen />} />

            {/* Roster (friends list) */}
            <Route path="roster" element={<RosterScreen />} />

            {/* Public Player Card (authenticated — full access) */}
            <Route path="u/:username" element={<PublicProfileRoute />} />
          </Route>
        </Route>

        {/* Catch-all → redirect to splash */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
