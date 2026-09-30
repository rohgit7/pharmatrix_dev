from app.services.notification_worker import process_pending_notifications


if __name__ == "__main__":
    count = process_pending_notifications()
    print(f"Processed notifications: {count}")