# ZoneHunt

Jogo multijogador de captura baseado em localização e realidade aumentada, feito com
Expo (React Native) e Firebase Firestore.

Cada jogador esconde bonecos virtuais dentro de uma área desenhada no mapa. Durante o
jogo, os jogadores andam pelo mundo real para detetar os bonecos adversários por
proximidade (GPS) e capturá-los através da câmara, apontando o telemóvel na direção
certa. Ganha quem capturar pelo menos um boneco de cada adversário.

## Fases do jogo

1. **Lobby** — o admin cria o jogo e partilha o código; os restantes jogadores entram.
2. **Área** — o admin define no mapa o polígono que delimita a zona de jogo.
3. **Colocar bonecos** — cada jogador esconde os seus bonecos dentro da área.
4. **A jogar** — deteção por proximidade no mapa e captura em AR com a câmara.
5. **Fim** — classificação final e vencedor.

## Stack

- [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction) (file-based routing)
- React Native + TypeScript
- [Firebase Firestore](https://firebase.google.com/docs/firestore) para estado em tempo real
- `react-native-maps`, `expo-location`, `expo-camera`, `expo-haptics`

## Começar

1. Instalar dependências:

   ```bash
   npm install
   ```

2. Definir as variáveis de ambiente do Firebase (ficheiro `.env`):

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

3. Arrancar a app:

   ```bash
   npx expo start
   ```

As fases com GPS, mapa e câmara precisam de um dispositivo físico (Android ou iOS).
Em web existe apenas um modo de demonstração limitado.
