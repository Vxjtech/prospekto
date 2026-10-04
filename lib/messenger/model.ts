import {z} from 'zod';
const id=z.string().min(1).max(100);
export const messengerAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('start'),contactId:id}).strict(),
  z.object({action:z.literal('send'),conversationId:id,body:z.string().trim().min(1,'Napište zprávu.').max(5000),clientId:z.string().uuid()}).strict(),
  z.object({action:z.literal('read'),conversationId:id,messageId:id}).strict(),
]);
export type Contact={id:string;name:string;type:string;avatarUrl:string;city:string};
export type Conversation=Contact&{conversationId:string;lastMessage:string;updatedAt:string;unread:number};
export type ChatMessage={id:string;senderAccountId:string;senderName:string;body:string;createdAt:string;requestTitle:string|null};
export type ChatPage={canSend:boolean;accepted:boolean;items:ChatMessage[];nextCursor:string|null};
