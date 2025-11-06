# ==========================
# File Manager Logic
# ==========================

import os
import time
import uuid
import json
import logging
from pathlib import Path
from typing import Optional, Dict
from datetime import datetime, timedelta
import threading

# Set up logger
logger = logging.getLogger(__name__)

class ProcessedFileManager:
    """
    Manages temp storage of processed audio files.
    Stores files with unique ID and metadata for preview/download.
    """

    def __init__(self, storage_dir: Path, ttl_hours: int = 1):
        """
        Initialize file manager.

        Args:
            storage_dir: Directory to store processed files
            ttl_hours: Time-to-live for files in hours (default = 1)
        """
        self.storage_dir = Path(storage_dir)
        self.metadata_dir= self.storage_dir / 'metadata'
        self.files_dir = self.storage_dir / 'files'
        self.ttl_seconds = ttl_hours * 3600

        # Create directories
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"ProcessedFileManager initialized at {self.storage_dir}")
        logger.info(f"File TTL: {ttl_hours}")

        # Start cleanup thread
        self._start_cleanup_thread()
    
    def store_file(self, filepath: str, original_filename: str,
                   output_format: str, preset: str, settings: Dict) -> str:
        """
        Store a processed file with metadata.

        Args:
            filepath: Path to the processed file
            original_filename: Original filename uploaded by user
            output_format: Output format (wav, mp3, etc.)
            preset: Preset used for processing
            settings: Processing settngs used
        
        Returns:
            Unique file ID
        """

        # Generate unique ID
        file_id = str(uuid.uuid4())

        # Store file
        stored_filepath = self.files_dir / f"{file_id}.{output_format}"

        # Copy file to storage
        import shutil
        shutil.copy2(filepath, stored_filepath)

        # Create metadata
        metadata = {
            'id': file_id,
            'original_filename': original_filename,
            'output_format': output_format,
            'preset': preset,
            'settings': settings,
            'stored_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(seconds=self.ttl_seconds)).isoformat(),
            'file_size': os.path.getsize(stored_filepath),
            'filepath': str(stored_filepath)
        }

        # Store metadata
        metadata_path = self.metadata_dir / f"{file_id}.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Stored file with ID: {file_id}")
        return file_id
    
    def get_file(self, file_id: str) -> Optional[Dict]:
        """
        Retrieve file information by ID.

        Args:
            file_id: Unique file identifier
        
        Returns:
            Dictionary with file metadata and path, or None if not found/expired
        """
        metadata_path = self.metadata_dir / f"{file_id}"

        if not metadata_path.exists():
            logger.warning(f"File not foundL {file_id}")
            return None
        
        # Load metadata
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Check if expired
        expires_at = datetime.fromisoformat(metadata['expires_at'])
        if datetime.now() > expires_at:
            logger.info(f"File exipred: {file_id}")
            self.delete_file(file_id)
            return None
        
        # Check if file exists
        filepath = Path(metadata['filepath'])
        if not filepath.exists():
            logger.warning(f"File missing on disk: {file_id}")
            self.delete_file(file_id)
            return None
        
    def delete_file(self, file_id: str) -> bool:
        """
        Delete a file and its metadata.

        Args:
            file_id: Unique file identifier
        
        Returns:
            True if deleted, False is not found
        """
        metadata_path = self.metadata_dir / f"{file_id}.json"

        if not metadata_path.exists():
            return False
        
        # Load metadata to get file path
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            # Delete file
            filepath = Path(metadata['filepath'])
            if filepath.exists():
                filepath.unlink()
                logger.debug(f"Deleted file: {filepath}")
            
            # Delete metadata
            metadata_path.unlink()
            logger.info(f"Deleted file and metadata: {file_id}")
            return True
        
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {e}")
            return False
        
    def cleanup_expired_files(self):
        """
        Remove all expired files and their metadata
        """
        logger.info("Running cleanup of expired files")
        deleted_count = 0
        for metadata_path in self.metadata_dir.glob("*.json"):
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                
                expires_at = datetime.fromisoformat(metadata['expires_at'])
                if datetime.now() > expires_at:
                    file_id = metadata['id']
                    if self.delete_file(file_id):
                        deleted_count += 1
            
            except Exception as e:
                logger.error(f"Error checking file {metadata_path}: {e}")
        
        logger.info(f"Cleanup complete. Deleted {deleted_count} expired files.")
    
    def _start_cleanup_thread(self):
        """
        Start background thread for periodic cleanup
        """
        def cleanup_loop():
            while True:
                time.sleep(1800) # Run every 30 minutes
                try:
                    self.cleanup_expired_files()
                except Exception as e:
                    logger.error(f"Error in cleanup thread: {e}")
        
        cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
        cleanup_thread.start()
        logger.info("Cleanup thread started")
    
    def get_stats(self) -> Dict:
        """
        Get stats about stored files
        """
        total_files = len(list(self.metadata_dir.glob("*.json")))
        total_size = sum(
            os.path.getsize(f)
            for f in self.files_dir.glob("*")
            if f.is_file()
        )

        return {
            'total_files': total_files,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size/ (1024*1024), 2),
            'storage_dir': str(self.storage_dir)
        }