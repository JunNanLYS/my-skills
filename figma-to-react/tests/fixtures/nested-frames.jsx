<Frame name="Card" width={320} height={200} padding={20} gap={12}
       direction="vertical" fill="#FAFAFA" cornerRadius={12}>
  <Frame name="header" width={280} height={40} gap={8}
         direction="horizontal" fill="#FFFFFF">
    <Rectangle name="avatar" width={32} height={32} fill="#10B981" cornerRadius={16} />
    <Text name="title" fontSize={16} fontWeight={700} fill="#111827">
      Card title
    </Text>
  </Frame>
  <Text name="body" fontSize={14} fontWeight={400} lineHeight={22} fill="#374151">
    This is a longer description that wraps onto two lines.
  </Text>
</Frame>
