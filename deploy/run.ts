import SftpClient from "ssh2-sftp-client"
import * as fs from "fs"
import * as path from "path"

const config = {
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD
} as const

const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry")
console.info(`DRY_RUN: ${DRY_RUN}`)
const env = Object.entries({
    SFTP_HOST: process.env.SFTP_HOST,
    SFTP_PORT: process.env.SFTP_PORT,
    SFTP_USERNAME: process.env.SFTP_USERNAME,
    SFTP_PASSWORD: process.env.SFTP_PASSWORD,
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK
})
const missing = env.filter(([, v]) => !v).map(([k]) => k)
if (missing.length > 0) {
    throw new Error(`Missing secrets/vars: ${missing.join(", ")}`)
}
if (DRY_RUN) {
    console.log("✅ All secrets & variables are set. Nothing was uploaded (dry-run).")
    process.exit(0)
}
const sftp = new SftpClient()

async function deleteDirectory(remoteDir: string) {
    const items = await sftp.list(remoteDir)
    for (const item of items) {
        const remotePath = path.posix.join(remoteDir, item.name)
        if (item.type === "d") {
            await deleteDirectory(remotePath)
            await sftp.rmdir(remotePath, true)
        } else {
            await sftp.delete(remotePath)
        }
    }
}

async function uploadDirectory(localDir: string, remoteDir: string) {
    for (const file of fs.readdirSync(localDir)) {
        const localPath = path.join(localDir, file)
        const remotePath = path.posix.join(remoteDir, file)
        if (fs.lstatSync(localPath).isDirectory()) {
            await sftp.mkdir(remotePath, true).catch(() => {/* exists */})
            await uploadDirectory(localPath, remotePath)
        } else {
            console.log(`upload ${remotePath}`)
            await sftp.put(localPath, remotePath)
        }
    }
}

async function uploadDirectoryExcluding(localDir: string, remoteDir: string, excludeFiles: string[]) {
    for (const file of fs.readdirSync(localDir)) {
        if (excludeFiles.includes(file)) {
            console.log(`skipping ${file}`)
            continue
        }
        const localPath = path.join(localDir, file)
        const remotePath = path.posix.join(remoteDir, file)
        if (fs.lstatSync(localPath).isDirectory()) {
            await sftp.mkdir(remotePath, true).catch(() => {/* exists */})
            await uploadDirectoryExcluding(localPath, remotePath, excludeFiles)
        } else {
            console.log(`upload ${remotePath}`)
            await sftp.put(localPath, remotePath)
        }
    }
}

async function deleteDirectoryExcept(localDir: string, remoteDir: string, preserveFiles: string[]) {
    const items = await sftp.list(remoteDir)
    for (const item of items) {
        const remotePath = path.posix.join(remoteDir, item.name)
        if (preserveFiles.includes(item.name)) {
            console.log(`preserving ${remotePath}`)
            continue
        }
        if (item.type === "d") {
            await deleteDirectory(remotePath)
            await sftp.rmdir(remotePath, true)
        } else {
            await sftp.delete(remotePath)
        }
    }
}

// --------------------- main -------------------------------------------------
(async () => {
    console.log(`⏩ upload…`)
    await sftp.connect(config)
    
    // Step 1: Replace index.html with update.html to show maintenance page
    console.log("🔄 Switching to maintenance mode...")
    const updateHtmlPath = "./packages/app/studio/public/update.html"
    if (fs.existsSync(updateHtmlPath)) {
        await sftp.put(updateHtmlPath, "/index.html")
        console.log("✅ Maintenance page is now active")
    } else {
        console.warn("⚠️  update.html not found, skipping maintenance mode")
    }
    
    // Step 2: Clean up old files except index.html (which is now the maintenance page)
    console.log("🧹 Cleaning up old files...")
    await deleteDirectoryExcept("/", "/", ["index.html"])
    
    // Step 3: Upload all new files except index.html
    console.log("📦 Uploading new files (excluding index.html)...")
    await uploadDirectoryExcluding("./packages/app/studio/dist", "/", ["index.html"])
    
    // Step 4: Replace update.html with new index.html to complete deployment
    console.log("🎯 Activating new version...")
    const newIndexPath = "./packages/app/studio/dist/index.html"
    if (fs.existsSync(newIndexPath)) {
        await sftp.put(newIndexPath, "/index.html")
        console.log("✅ New version is now live!")
    } else {
        console.error("❌ New index.html not found!")
    }
    
    await sftp.end()
    const webhookUrl = process.env.DISCORD_WEBHOOK
    if (webhookUrl) {
        console.log("posting to discord...")
        const now = Math.floor(Date.now() / 1000) // in seconds
        const content = `🚀 **openDAW** has been deployed to <https://opendaw.studio> <t:${now}:R>.`
        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({content})
            })
            console.log(response)
        } catch (error) {
            console.warn(error)
        }
    }
    console.log("deploy complete")
})()
