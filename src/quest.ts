/// <reference types="@workadventure/iframe-api-typings" />

import { getQuest, levelUp } from "@workadventure/quests";

const QUEST_KEY = "OFFICE_EXPLORER";
const REQUIRED_XP = 2;

type QuestTask = {
    areaName: string;
    stateKey: "officeExplorerAmphitheatre" | "officeExplorerMeetingRoom";
};

const TASKS: readonly QuestTask[] = [
    {
        areaName: "quest_amphitheatre",
        stateKey: "officeExplorerAmphitheatre",
    },
    {
        areaName: "quest_meeting_room",
        stateKey: "officeExplorerMeetingRoom",
    },
];

const sessionCompletions = new Set<QuestTask["stateKey"]>();
let questCompleted = false;
let awardQueue: Promise<void> = Promise.resolve();

function hasSavedCompletion(task: QuestTask): boolean {
    return WA.player.state[task.stateKey] === true;
}

async function saveCompletion(stateKey: QuestTask["stateKey"]): Promise<void> {
    await WA.player.state.saveVariable(stateKey, true, {
        public: false,
        persist: true,
        scope: "world",
    });
}

async function saveAllCompletions(): Promise<void> {
    for (const task of TASKS) {
        if (!hasSavedCompletion(task)) {
            await saveCompletion(task.stateKey);
        }
        sessionCompletions.add(task.stateKey);
    }
}

async function completeTask(task: QuestTask): Promise<void> {
    if (
        questCompleted ||
        sessionCompletions.has(task.stateKey) ||
        hasSavedCompletion(task)
    ) {
        return;
    }

    sessionCompletions.add(task.stateKey);

    try {
        const quest = await getQuest(QUEST_KEY);

        if (quest.xp >= REQUIRED_XP) {
            questCompleted = true;
            await saveAllCompletions();
            return;
        }

        await levelUp(QUEST_KEY, 1);
        await saveCompletion(task.stateKey);

        if (quest.xp + 1 >= REQUIRED_XP) {
            questCompleted = true;
            await saveAllCompletions();
        }

        console.info(
            `Quest ${QUEST_KEY}: completed area ${task.areaName}`,
        );
    } catch (error) {
        sessionCompletions.delete(task.stateKey);
        console.error(
            `Quest ${QUEST_KEY}: could not complete area ${task.areaName}`,
            error,
        );
    }
}

WA.onInit()
    .then(async () => {
        if (!WA.player.isLogged) {
            console.info(
                `Quest ${QUEST_KEY}: the player must sign in before progress can be saved.`,
            );
            return;
        }

        try {
            const quest = await getQuest(QUEST_KEY);
            if (quest.xp >= REQUIRED_XP) {
                questCompleted = true;
                await saveAllCompletions();
            }
        } catch (error) {
            console.error(`Quest ${QUEST_KEY}: initialization failed`, error);
        }

        for (const task of TASKS) {
            WA.mapEditor.area.onEnter(task.areaName).subscribe(() => {
                awardQueue = awardQueue
                    .then(() => completeTask(task))
                    .catch((error) => {
                        console.error(
                            `Quest ${QUEST_KEY}: award queue failed`,
                            error,
                        );
                    });
            });
        }
    })
    .catch((error) => {
        console.error(`Quest ${QUEST_KEY}: WorkAdventure failed to initialize`, error);
    });

export {};
