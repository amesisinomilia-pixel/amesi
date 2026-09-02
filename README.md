# Office Explorer quest for WorkAdventure

This package adds the `OFFICE_EXPLORER` quest to the existing Office room while preserving the room's current clock, CaiPRUS, and Scripting API Extra behavior.

## Quest behavior

- Enter `quest_amphitheatre`: award 1 XP once.
- Enter `quest_meeting_room`: award 1 XP once.
- The order does not matter.
- Progress is stored privately and persistently for each signed-in player.
- At 2 XP, WorkAdventure awards `OFFICE_EXPLORER_COMPLETED` using the quest configuration in the administration dashboard.
- Guest players do not receive quest XP; they must sign in.

## Ready-to-upload map

The outer package contains `office-explorer-upload.zip`. Upload that inner ZIP to the existing `direct/` map directory using the WorkAdventure map upload screen. It intentionally does **not** include a `.wam` file, so the online-editor entities and areas remain separate.

Before uploading, keep the included `backup/amesidimokratia.wam` as a backup of the online-editor content.

After upload, test with a signed-in account that has not completed the quest:

1. Enter either quest area and confirm the quest reaches 1 XP.
2. Enter the other quest area and confirm it reaches 2 XP.
3. Confirm the `OFFICE_EXPLORER_COMPLETED` badge is awarded.
4. Re-enter both areas and confirm the XP remains 2.

## Rebuild from the latest live map

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
npm run build
```

The build first downloads the latest live `.tmj`, its local images, the room's current compiled script, and a `.wam` backup. It then changes only the Tiled `script` property and outputs the uploadable files in `dist/`.

Create a new upload ZIP from the contents of `dist/`, with `amesidimokratia.tmj` at the ZIP root.

## Important identifiers

| Item | Value |
| --- | --- |
| Quest key | `OFFICE_EXPLORER` |
| Badge key | `OFFICE_EXPLORER_COMPLETED` |
| Amphitheatre area | `quest_amphitheatre` |
| Meeting-room area | `quest_meeting_room` |
| Required XP | `2` |

