# Video Call Application - WebRTC Group Chat

This project is a real-time video call application using WebRTC technology and the Selective Forwarding Unit (SFU) model to support group video chat.

## Main Features

- **Multi-user Video Call**: Allows multiple users to join the same video conference room
- **Screen Sharing**: Users can share their screen with others in the call
- **Room Security**: Ability to lock the room with a password
- **Text Chat**: Chat feature alongside video call
- **Audio and Video Control**: Turn on/off microphone and camera
- **Responsive Interface**: Works well on both computers and mobile devices

## Technologies Used

This project is built with:

- **WebRTC**: Technology that enables real-time audio and video transmission
- **PeerJS**: Library that simplifies the use of WebRTC
- **Socket.IO**: Provides real-time connection between client and server
- **Vite**: Modern build tool for frontend
- **TypeScript**: Strongly typed programming language
- **React**: JavaScript library for building user interfaces
- **shadcn-ui**: Highly customizable UI component system
- **Tailwind CSS**: Utility-first CSS framework

## How to Use

1. **Create a new room**: Enter your name and press "Create New Room"
2. **Join an existing room**: Enter your name and room ID, then press "Join Room"
3. **In the call**: Use the control buttons at the bottom to turn on/off camera, microphone, screen sharing, and open chat

## Installation and Development

Follow these steps to run the project on your computer:

```sh
# Step 1: Clone the repository FE
git clone https://github.com/xuantruongg03/video-call-group.git

# Step 2: Clone BE
git https://github.com/xuantruongg03/video-call-group-be.git

# Step 3: Move to the BE project directory
cd video-call-group-be

# Step 3: Install dependencies
npm i

# Step 4: Start the development server with auto-reload feature
npm run dev

# Step 5: Move to FE
cd video-call-group

# Step 6: Install dependencies
npm i

# Step 7: Run
npm run start:dev
```

## System Architecture

The system uses the SFU (Selective Forwarding Unit) model, allowing multiple users to join the same video call without needing direct connections between all endpoints. This enables the system to scale better as the number of participants increases.

## Deployment

You can deploy this project on various hosting platforms such as Vercel, Netlify, or other cloud services.

## Author

xuantruongg03
