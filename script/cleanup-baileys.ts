/**
 * Cleanup script for Baileys authentication directory
 * Keeps only the latest versions of essential files to prevent disk bloat
 * 
 * Files structure:
 * - app-state-sync-key-*.json: Latest version only (oldest can be deleted)
 * - pre-key-*.json: Keep all (deletion breaks encryption)
 * - session-*.json: Keep latest version per device, remove old ones
 * - device-list-*.json: Keep latest (contains current device state)
 * - creds.json: Essential (never delete)
 * - other files: Keep as-is
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileInfo {
  name: string;
  path: string;
  timestamp: number;
  size: number;
}

const BAILEYS_DIR = path.resolve('auth_info_baileys');
const SAFE_EXTENSIONS = ['.json']; // Only delete JSON files

function getFileType(filename: string): string {
  if (filename === 'creds.json') return 'creds';
  if (filename.startsWith('app-state-sync-key-')) return 'app-state-sync';
  if (filename.startsWith('pre-key-')) return 'pre-key';
  if (filename.startsWith('session-')) return 'session';
  if (filename.startsWith('device-list-')) return 'device-list';
  if (filename.startsWith('lid-mapping-')) return 'lid-mapping';
  if (filename.startsWith('sender-key-')) return 'sender-key';
  if (filename.startsWith('tctoken-')) return 'tctoken';
  return 'other';
}

function cleanupAuthFiles(dryRun: boolean = true): void {
  if (!fs.existsSync(BAILEYS_DIR)) {
    console.log('⚠️  auth_info_baileys directory not found. Nothing to clean.');
    return;
  }

  const files = fs.readdirSync(BAILEYS_DIR);
  const filesByType = new Map<string, FileInfo[]>();
  let totalSize = 0;
  let totalFiles = 0;

  // Group files by type
  files.forEach(filename => {
    if (!SAFE_EXTENSIONS.some(ext => filename.endsWith(ext))) {
      return; // Skip non-JSON files
    }

    const filepath = path.join(BAILEYS_DIR, filename);
    const stats = fs.statSync(filepath);
    const fileType = getFileType(filename);

    if (!filesByType.has(fileType)) {
      filesByType.set(fileType, []);
    }

    filesByType.get(fileType)!.push({
      name: filename,
      path: filepath,
      timestamp: stats.mtimeMs,
      size: stats.size,
    });

    totalSize += stats.size;
    totalFiles += 1;
  });

  console.log(`📊 Auth files analysis:`);
  console.log(`   Total files: ${totalFiles}`);
  console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  let filesToDelete: FileInfo[] = [];

  // Process each file type
  filesByType.forEach((typeFiles, fileType) => {
    console.log(`${fileType}: ${typeFiles.length} files`);

    switch (fileType) {
      case 'creds':
        // Never delete creds.json
        console.log('  ✓ KEEP creds.json (essential)\n');
        break;

      case 'pre-key':
        // Pre-keys are needed for encryption - keep all
        console.log(`  ✓ KEEP all ${typeFiles.length} pre-keys (encryption required)\n`);
        break;

      case 'app-state-sync':
        // Keep only latest version
        typeFiles.sort((a, b) => b.timestamp - a.timestamp);
        const toDelete = typeFiles.slice(1); // All except latest
        filesToDelete.push(...toDelete);
        console.log(`  ✓ KEEP 1 latest | DELETE ${toDelete.length} old versions\n`);
        break;

      case 'session':
        // Keep only latest version of each device
        const byDevice = new Map<string, FileInfo[]>();
        typeFiles.forEach(file => {
          // Extract device ID (everything between "session-" and first ".")
          const match = file.name.match(/^session-([^.]+)/);
          const deviceId = match ? match[1] : 'unknown';
          if (!byDevice.has(deviceId)) {
            byDevice.set(deviceId, []);
          }
          byDevice.get(deviceId)!.push(file);
        });

        let keptSessions = 0;
        byDevice.forEach((deviceFiles) => {
          deviceFiles.sort((a, b) => b.timestamp - a.timestamp);
          keptSessions += 1;
          const toDelete = deviceFiles.slice(1);
          filesToDelete.push(...toDelete);
        });
        console.log(`  ✓ KEEP ${keptSessions} devices | DELETE ${filesToDelete.filter(f => f.name.startsWith('session-')).length} old versions\n`);
        break;

      case 'device-list':
        // Keep only latest version
        typeFiles.sort((a, b) => b.timestamp - a.timestamp);
        const deleteDevices = typeFiles.slice(1);
        filesToDelete.push(...deleteDevices);
        console.log(`  ✓ KEEP 1 latest | DELETE ${deleteDevices.length} old versions\n`);
        break;

      case 'sender-key':
        // Keep only latest per sender
        const bySender = new Map<string, FileInfo[]>();
        typeFiles.forEach(file => {
          const match = file.name.match(/^sender-key-(.+)\.json$/);
          const senderId = match ? match[1] : 'unknown';
          if (!bySender.has(senderId)) {
            bySender.set(senderId, []);
          }
          bySender.get(senderId)!.push(file);
        });

        let keptSenders = 0;
        bySender.forEach((senderFiles) => {
          senderFiles.sort((a, b) => b.timestamp - a.timestamp);
          keptSenders += 1;
          const deleteSender = senderFiles.slice(1);
          filesToDelete.push(...deleteSender);
        });
        console.log(`  ✓ KEEP ${keptSenders} senders | DELETE ${filesToDelete.filter(f => f.name.startsWith('sender-key-')).length} old versions\n`);
        break;

      default:
        console.log(`  ✓ KEEP all ${typeFiles.length} (unknown type)\n`);
    }
  });

  // Summary
  if (filesToDelete.length > 0) {
    const spaceFreed = filesToDelete.reduce((sum, f) => sum + f.size, 0);
    console.log(`🧹 Cleanup Results:`);
    console.log(`   Files to delete: ${filesToDelete.length}`);
    console.log(`   Space to free: ${(spaceFreed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Reduction: ${((spaceFreed / totalSize) * 100).toFixed(1)}%\n`);

    if (!dryRun) {
      console.log('🗑️  Deleting files...');
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`   Deleted: ${file.name}`);
        } catch (err) {
          console.error(`   Error deleting ${file.name}:`, err);
        }
      });
      console.log('✅ Cleanup complete!');
    } else {
      console.log('ℹ️  DRY RUN MODE - No files were deleted');
      console.log('   Run with --execute to actually delete files\n');
      console.log('   Files that will be deleted:');
      filesToDelete.slice(0, 10).forEach(f => console.log(`   - ${f.name}`));
      if (filesToDelete.length > 10) {
        console.log(`   ... and ${filesToDelete.length - 10} more`);
      }
    }
  } else {
    console.log('✅ No files need cleanup!');
  }
}

// Main execution
const isDryRun = !process.argv.includes('--execute');
cleanupAuthFiles(isDryRun);
