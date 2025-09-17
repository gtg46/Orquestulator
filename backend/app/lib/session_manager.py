import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Any
from app.lib.config import config


class SessionManager:
    """
    In-memory session management for Orquestulator.
    Stores session data securely on the server side.
    """

    def __init__(
        self,
        session_timeout_hours: int = config.SESSION_TIMEOUT_HOURS,
        # To prevent memory bloat or having a complex garbage collection process,
        # we can spread the load of cleanup as we interact with sessions.
        proactive_cleanup: bool = config.PROACTIVE_SESSION_CLEANUP,
    ):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        # list of session IDs ordered old to recent activity
        self.session_activity_order = []
        self.session_timeout = timedelta(hours=session_timeout_hours)
        self.proactive_cleanup = proactive_cleanup

    def create_session(self, session_data: Optional[Dict[str, Any]] = None) -> str:
        """Create a new session and return session ID"""
        # Progressive cleanup of expired sessions
        if self.proactive_cleanup:
            self._cleanup_expired_sessions()

        session_id = secrets.token_urlsafe(32)  # Cryptographically secure random string
        now = datetime.now(timezone.utc)

        self.sessions[session_id] = {
            "last_activity": now,
            "data": session_data or {},
        }

        self.session_activity_order.append(session_id)

        return session_id

    def get_session(
        self, session_id: str, update_activity: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Get all data from session"""
        # Progressive cleanup of expired sessions
        if self.proactive_cleanup:
            self._cleanup_expired_sessions()

        session = self._get_session_or_delete(session_id)

        if not session:
            return None

        if update_activity:
            self.update_activity(session_id)

        return session

    def get_session_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get all data from session"""
        # Progressive cleanup of expired sessions
        if self.proactive_cleanup:
            self._cleanup_expired_sessions()

        session = self._get_session_or_delete(session_id)

        if not session:
            return None

        self.update_activity(session_id)

        return session["data"]

    def set_session_data(self, session_id: str, data: Dict[str, Any]) -> bool:
        """Update session data. Returns True if successful, False if session not found."""
        # Progressive cleanup of expired sessions
        if self.proactive_cleanup:
            self._cleanup_expired_sessions()

        session = self._get_session_or_delete(session_id)

        if not session:
            return False

        session["data"].update(data)

        self.update_activity(session_id)

        return True

    def update_activity(self, session_id: str) -> bool:
        """Update the last activity timestamp of a session. Returns True if successful, False if session not found."""
        # Progressive cleanup of expired sessions
        if self.proactive_cleanup:
            self._cleanup_expired_sessions()

        session = self._get_session_or_delete(session_id)

        if not session:
            return False

        # Move to end (most recent)
        try:
            self.session_activity_order.remove(session_id)
        except ValueError:
            # Session ID not in activity order list - add it
            pass
        self.session_activity_order.append(session_id)

        session["last_activity"] = datetime.now(timezone.utc)
        return True

    def delete_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Delete a session. Returns session data if session existed, None otherwise."""
        # Progressive cleanup of expired sessions
        if self.proactive_cleanup:
            self._cleanup_expired_sessions()

        return self._delete_session(session_id)

    def _get_session_or_delete(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Gets session data if active, else deletes and returns None"""
        if self._is_session_active(session_id):
            return self.sessions[session_id]
        else:
            self._delete_session(session_id)
            return None

    def _is_session_active(self, session_id: str) -> bool:
        """Check if a session is active (exists and not expired)"""
        if not session_id in self.sessions:
            return False
        session = self.sessions[session_id]
        return session["last_activity"] + self.session_timeout > datetime.now(
            timezone.utc
        )

    def _cleanup_expired_sessions(self) -> list:
        """Remove all expired sessions from memory"""
        expired_sessions = []
        if not self.sessions:
            return expired_sessions
        while self.session_activity_order and not self._is_session_active(
            self.session_activity_order[0]
        ):
            oldest_session_id = self.session_activity_order[0]
            expired_sessions.append(oldest_session_id)
            self._delete_session(oldest_session_id)

        return expired_sessions

    def get_session_count_info(self) -> Dict[str, Any]:
        """Get session count and activity information for monitoring"""
        # Don't run cleanup here - we want to see the true state for monitoring

        total_sessions = len(self.sessions)
        active_sessions = 0

        # Count active (non-expired) sessions
        for session_id in self.sessions:
            if self._is_session_active(session_id):
                active_sessions += 1

        return {"total_sessions": total_sessions, "active_sessions": active_sessions}

    def _delete_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Delete a session. Returns session data if session existed, None otherwise."""
        # Safely remove from activity order list (might not be present due to race conditions)
        try:
            self.session_activity_order.remove(session_id)
        except ValueError:
            # Session ID not in activity order list - this can happen in edge cases
            pass

        return self.sessions.pop(session_id, None)


# Global session manager instance
session_manager = SessionManager(
    session_timeout_hours=config.SESSION_TIMEOUT_HOURS,
    proactive_cleanup=config.PROACTIVE_SESSION_CLEANUP,
)
