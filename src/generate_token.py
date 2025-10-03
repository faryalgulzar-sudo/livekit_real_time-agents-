from livekit import api

# Local LiveKit server ke credentials (livekit.yaml me diye hote hain)
API_KEY = "devkey"
API_SECRET = "secret"

def generate_token(room_name: str, identity: str) -> str:
    """
    Generate a JWT access token for LiveKit
    """
    at = api.AccessToken(API_KEY, API_SECRET)

    # Grant permissions (join/publish/subscribe)
    at.with_grants(
        api.VideoGrants(
            room=room_name,
            room_join=True,
            can_publish=True,
            can_subscribe=True,
        )
    )

    # unique identity (like username)
    at.identity = identity

    return at.to_jwt()

if __name__ == "__main__":
    # Example usage
    token = generate_token("test-room", "user-456")
    print("Generated LiveKit token:\n")
    print(token)
