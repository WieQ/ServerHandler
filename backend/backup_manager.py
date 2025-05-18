import os
import shutil
from datetime import datetime

class BackupManager:
    def __init__(self, source_dir: str, backup_root: str):
        self.source_dir = source_dir
        self.backup_root = backup_root
        os.makedirs(self.backup_root, exist_ok=True)

    def create_backup(self) -> str:
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_name = f"backup_{timestamp}"
        backup_path = os.path.join(self.backup_root, backup_name)
        shutil.copytree(self.source_dir, backup_path)
        return backup_path

    def list_backups(self):
        return sorted(
            [
                {
                    "name": name,
                    "path": os.path.join(self.backup_root, name)
                }
                for name in os.listdir(self.backup_root)
                if os.path.isdir(os.path.join(self.backup_root, name))
            ],
            key=lambda x: x["name"],
            reverse=True
        )

    def _force_remove(self, func, path, exc_info):
        """Wymusza usunięcie plików tylko do odczytu."""
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception as e:
            print(f"Nie udało się wymusić usunięcia {path}: {e}")

    def delete_backup(self, backup_name: str) -> bool:
        path = os.path.join(self.backup_root, backup_name)
        if os.path.exists(path) and os.path.isdir(path):
            shutil.rmtree(path, onerror=self._force_remove)
            return True
        return False