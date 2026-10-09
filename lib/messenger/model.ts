import {z} from 'zod';
const id=z.string().min(1).max(100);
export const messengerAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('start'),offerId:id}).strict(),
  z.object({action:z.literal('send'),conversationId:id,body:z.string().trim().min(1,'Napište zprávu.').max(5000),clientId:z.string().uuid()}).strict(),
  z.object({action:z.literal('read'),conversationId:id,messageId:id}).strict(),
]);
export type Conversation={conversationId:string;requestId:string;requestTitle:string;requestPhoto:string;lastMessage:string;updatedAt:string;unread:number};
export type ChatMessage={id:string;isOwn:boolean;body:string;createdAt:string};
export type ChatPage={requestId:string;requestTitle:string;requestPhoto:string;canSend:boolean;accepted:boolean;items:ChatMessage[];nextCursor:string|null};
