import React from "react";
import PropTypes from "prop-types";
import { useDropzone } from "react-dropzone";
import { Box, Text, Spinner, useColorModeValue } from "@chakra-ui/react";

const UploadZone = ({ onUpload, uploading = false }) => {
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "application/json": [".json"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const borderColor = useColorModeValue("gray.300", "gray.600");
  const hoverBorderColor = useColorModeValue("teal.500", "teal.300");
  const bgColor = useColorModeValue("gray.50", "gray.700");

  return (
    <Box
      {...getRootProps()}
      border="2px dashed"
      borderColor={borderColor}
      borderRadius="md"
      p={6}
      textAlign="center"
      cursor={uploading ? "not-allowed" : "pointer"}
      _hover={!uploading ? { borderColor: hoverBorderColor } : {}}
      bg={bgColor}
      transition="border-color 0.2s"
      opacity={uploading ? 0.7 : 1}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <>
          <Spinner size="md" color="teal.500" mb={3} />
          <Text fontWeight="medium">Загрузка чека...</Text>
        </>
      ) : (
        <>
          <Text fontWeight="medium" mb={2}>
            Загрузите чек
          </Text>
          <Text fontSize="sm" color="gray.500">
            Перетащите JSON или изображение чека сюда
          </Text>
          <Text fontSize="xs" color="gray.400" mt={1}>
            или кликните для выбора файла
          </Text>
          <Text fontSize="xs" color="gray.500" mt={3}>
            Поддерживаемые форматы: JSON, PNG, JPG, JPEG
          </Text>
        </>
      )}
    </Box>
  );
};

UploadZone.propTypes = {
  onUpload: PropTypes.func.isRequired,
  uploading: PropTypes.bool,
};

export default UploadZone;
