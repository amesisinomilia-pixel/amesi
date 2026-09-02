declare module "@workadventure/quests" {
    export type QuestDescriptor = {
        name: string;
        description: string;
        key: string;
        icon_url: string;
        xp: number;
        badges: unknown[];
    };

    export function getQuest(questKey: string): Promise<QuestDescriptor>;

    export function levelUp(
        questKey: string,
        xp: number,
    ): Promise<unknown>;
}
