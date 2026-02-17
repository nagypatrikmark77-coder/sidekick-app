import { Text, View } from "react-native";

export default function Home() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0f172a",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: "black",
          fontSize: 28,
          fontWeight: "bold",
        }}
      >
        Sidekick MVP 🚀
      </Text>
    </View>
  );
}
