import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

class Database:
    def __init__(self):
        self.conn = None
        self.config = {
            "host": os.getenv("DB_HOST"),
            "port": int(os.getenv("DB_PORT", 4000)),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME"),
            "autocommit": True,
            "ssl_disabled": False
        }

    def get_connection(self):
        if self.conn is None or not self.conn.is_connected():
            self.conn = mysql.connector.connect(**self.config)
        return self.conn

    def get_cursor(self):
        return self.get_connection().cursor(dictionary=True)

    def close(self):
        if self.conn and self.conn.is_connected():
            self.conn.close()
            self.conn = None