import mysql.connector
from mysql.connector import pooling

class Database:
    def __init__(self):
        self.config = {
            'host': 'localhost',
            'user': 'root',
            'password': '12345',
            'database': 'flight_game',
            'autocommit': True
        }
        self.conn = None
    
    def get_connection(self):
        """Get database connection"""
        if self.conn is None or not self.conn.is_connected():
            self.conn = mysql.connector.connect(**self.config)
        return self.conn
    
    def get_cursor(self):
        """Get cursor with dictionary results"""
        conn = self.get_connection()
        return conn.cursor(dictionary=True)
    
    def close(self):
        """Close connection"""
        if self.conn and self.conn.is_connected():
            self.conn.close()
            self.conn = None