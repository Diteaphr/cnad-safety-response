from google.cloud import pubsub_v1
from app.core.config import settings

# Initialize Pub/Sub Publisher Client
# The client automatically picks up the credentials from GOOGLE_APPLICATION_CREDENTIALS
# which was set in config.py
publisher = pubsub_v1.PublisherClient()
project_id = settings.project_id

def get_topic_path(topic_id: str) -> str:
    return publisher.topic_path(project_id, topic_id)
